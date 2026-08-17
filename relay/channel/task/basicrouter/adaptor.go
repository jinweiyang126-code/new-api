package basicrouter

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// TaskAdaptor adapts OpenAI-shaped /v1/videos to BasicRouter /v1/video-generations.
type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

type videoSubmitRequest struct {
	VideoType  int      `json:"videoType"`
	Text       string   `json:"text"`
	Model      string   `json:"model"`
	Resolution string   `json:"resolution,omitempty"`
	Ratio      string   `json:"ratio,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	ImageURLs  []string `json:"imageUrls,omitempty"`
}

type videoSubmitEnvelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskID string `json:"taskId"`
	} `json:"data"`
}

type videoPollEnvelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskID       string `json:"taskId"`
		Status       string `json:"status"`
		ErrorMessage string `json:"errorMessage"`
		VideoURL     string `json:"videoUrl"`
		LastFrameURL string `json:"lastFrameUrl"`
	} `json:"data"`
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	if a.baseURL == "" {
		a.baseURL = defaultBaseURL
	}
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds <= 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 5
	}
	return map[string]float64{
		"seconds": float64(seconds),
	}
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + videoSubmitPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	payload, err := a.convertToSubmitPayload(&req, info)
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) convertToSubmitPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*videoSubmitRequest, error) {
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = req.Model
	}
	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds <= 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 5
	}

	resolution, ratio := mapVideoSize(req.Size)
	payload := &videoSubmitRequest{
		VideoType:  defaultVideoTypeText2V,
		Text:       req.Prompt,
		Model:      modelName,
		Resolution: resolution,
		Ratio:      ratio,
		Duration:   seconds,
	}
	if req.HasImage() {
		payload.VideoType = 2 // image-to-video (first frame)
		payload.ImageURLs = append([]string{}, req.Images...)
	}

	// Optional metadata overrides (videoType / resolution / ratio / duration).
	if req.Metadata != nil {
		_ = taskcommon.UnmarshalMetadata(req.Metadata, payload)
		payload.Model = modelName
		if payload.Text == "" {
			payload.Text = req.Prompt
		}
	}
	return payload, nil
}

func mapVideoSize(size string) (resolution, ratio string) {
	size = strings.TrimSpace(strings.ToLower(size))
	switch size {
	case "1792x1024", "1920x1080", "1280x720":
		return "1080p", "16:9"
	case "1024x1792", "1080x1920", "720x1280":
		return "1080p", "9:16"
	case "1024x1024":
		return "720p", "1:1"
	}
	if strings.Contains(size, "1080") {
		return "1080p", "16:9"
	}
	if strings.Contains(size, "720") {
		return "720p", "16:9"
	}
	return "720p", "16:9"
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var envelope videoSubmitEnvelope
	if err := common.Unmarshal(responseBody, &envelope); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if envelope.Code != 0 && envelope.Code != 200 {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s", envelope.Message), "basicrouter_submit_failed", http.StatusBadGateway)
		return
	}
	upstreamID := envelope.Data.TaskID
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("taskId is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	ov.Status = dto.VideoStatusQueued

	c.JSON(http.StatusOK, ov)
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	uri := strings.TrimRight(baseURL, "/") + videoSubmitPath + "/" + taskID
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var poll videoPollEnvelope
	if err := common.Unmarshal(respBody, &poll); err != nil {
		return nil, errors.Wrap(err, "unmarshal basicrouter video poll failed")
	}
	taskResult := &relaycommon.TaskInfo{Code: 0}
	status := strings.ToLower(poll.Data.Status)
	switch status {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = taskcommon.ProgressQueued
	case "processing", "running", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressInProgress
	case "success", "succeeded", "completed":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Url = poll.Data.VideoURL
	case "failed", "error", "cancelled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Reason = poll.Data.ErrorMessage
		if taskResult.Reason == "" {
			taskResult.Reason = poll.Message
		}
		if taskResult.Reason == "" {
			taskResult.Reason = "video generation failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressSubmitted
	}
	return taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.TaskID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName

	var poll videoPollEnvelope
	if len(originTask.Data) > 0 {
		_ = common.Unmarshal(originTask.Data, &poll)
		if poll.Data.VideoURL != "" {
			openAIVideo.SetMetadata("url", poll.Data.VideoURL)
		}
		if poll.Data.LastFrameURL != "" {
			openAIVideo.SetMetadata("last_frame_url", poll.Data.LastFrameURL)
		}
		if originTask.Status == model.TaskStatusFailure {
			msg := poll.Data.ErrorMessage
			if msg == "" {
				msg = poll.Message
			}
			openAIVideo.Error = &dto.OpenAIVideoError{
				Message: msg,
				Code:    "basicrouter_video_failed",
			}
		}
	}
	if originTask.GetResultURL() != "" {
		openAIVideo.SetMetadata("url", originTask.GetResultURL())
	}
	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
