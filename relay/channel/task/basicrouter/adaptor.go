package basicrouter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

// TaskAdaptor adapts OpenAI-shaped /v1|/pg videos and images to BasicRouter async APIs.
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

type imageSubmitRequest struct {
	Text       string   `json:"text"`
	Model      string   `json:"model"`
	ImageURLs  []string `json:"imageUrls,omitempty"`
	Count      int      `json:"count,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Ratio      string   `json:"ratio,omitempty"`
}

type submitEnvelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskID string `json:"taskId"`
	} `json:"data"`
}

type pollEnvelope struct {
	Code    json.RawMessage `json:"code"`
	Message string          `json:"message"`
	Data    pollData        `json:"data"`
}

type pollData struct {
	TaskID       string          `json:"taskId"`
	Status       string          `json:"status"`
	ErrorMessage json.RawMessage `json:"errorMessage"`
	VideoURL     string          `json:"videoUrl"`
	LastFrameURL string          `json:"lastFrameUrl"`
	Images       json.RawMessage `json:"images"`
	ImageURLs    json.RawMessage `json:"imageUrls"`
	ImageURL     json.RawMessage `json:"imageUrl"`
	URL          json.RawMessage `json:"url"`
	Text         json.RawMessage `json:"text"`
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	if a.baseURL == "" {
		a.baseURL = defaultBaseURL
	}
	a.apiKey = info.ApiKey
}

func isImageTask(info *relaycommon.RelayInfo) bool {
	return info != nil && info.Action == constant.TaskActionImageGenerate
}

func isImagePath(path string) bool {
	return strings.Contains(path, "/images/generations")
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if isImagePath(c.Request.URL.Path) {
		return validateImageTaskRequest(c, info)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func validateImageTaskRequest(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	var imgReq dto.ImageRequest
	if err := common.UnmarshalBodyReusable(c, &imgReq); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}
	if strings.TrimSpace(imgReq.Model) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}
	if strings.TrimSpace(imgReq.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt field is required"), "missing_prompt", http.StatusBadRequest)
	}
	count := 1
	if imgReq.N != nil && *imgReq.N > 0 {
		count = int(*imgReq.N)
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: imgReq.Prompt,
		Model:  imgReq.Model,
		Size:   imgReq.Size,
		Metadata: map[string]interface{}{
			"count":    count,
			"quality":  imgReq.Quality,
			"n":        count,
			"response": imgReq.ResponseFormat,
		},
	}
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionImageGenerate, req)
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	if isImageTask(info) {
		count := 1.0
		if req.Metadata != nil {
			switch v := req.Metadata["count"].(type) {
			case float64:
				if v > 0 {
					count = v
				}
			case int:
				if v > 0 {
					count = float64(v)
				}
			}
		}
		return map[string]float64{"n": count}
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

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base := strings.TrimRight(a.baseURL, "/")
	if isImageTask(info) {
		return base + imageSubmitPath, nil
	}
	return base + videoSubmitPath, nil
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
	var payload any
	if isImageTask(info) {
		payload, err = a.convertToImageSubmitPayload(&req, info)
	} else {
		payload, err = a.convertToVideoSubmitPayload(&req, info)
	}
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) convertToImageSubmitPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*imageSubmitRequest, error) {
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = req.Model
	}
	count := 1
	if req.Metadata != nil {
		switch v := req.Metadata["count"].(type) {
		case float64:
			if v > 0 {
				count = int(v)
			}
		case int:
			if v > 0 {
				count = v
			}
		}
	}
	quality := ""
	if req.Metadata != nil {
		if q, ok := req.Metadata["quality"].(string); ok {
			quality = q
		}
	}
	payload := &imageSubmitRequest{
		Text:       req.Prompt,
		Model:      modelName,
		Count:      count,
		Resolution: resolutionFromSizeQuality(req.Size, quality),
		Ratio:      ratioFromSize(req.Size),
	}
	if req.HasImage() {
		payload.ImageURLs = append([]string{}, req.Images...)
	}
	if req.Metadata != nil {
		_ = taskcommon.UnmarshalMetadata(req.Metadata, payload)
		payload.Model = modelName
		if payload.Text == "" {
			payload.Text = req.Prompt
		}
	}
	if len(payload.ImageURLs) == 0 {
		payload.ImageURLs = nil
	}
	return payload, nil
}

func resolutionFromSizeQuality(size, quality string) string {
	quality = strings.ToLower(strings.TrimSpace(quality))
	if strings.Contains(quality, "hd") || strings.Contains(quality, "2k") || quality == "high" {
		return "2k"
	}
	size = strings.ToLower(size)
	if strings.Contains(size, "2048") || strings.Contains(size, "1792") {
		return "2k"
	}
	if size == "" {
		return defaultImageResolution
	}
	return "1k"
}

func ratioFromSize(size string) string {
	switch size {
	case "1024x1024", "2048x2048":
		return "1:1"
	case "1792x1024", "2048x1152":
		return "16:9"
	case "1024x1792", "1152x2048":
		return "9:16"
	case "1536x1024", "1248x832":
		return "3:2"
	case "1024x1536", "832x1248":
		return "2:3"
	case "1152x864":
		return "4:3"
	case "864x1152":
		return "3:4"
	}
	width, height, ok := parseWxH(size)
	if !ok {
		return defaultImageRatio
	}
	if width == height {
		return "1:1"
	}
	if width > height {
		if float64(width)/float64(height) > 1.4 {
			return "16:9"
		}
		return "4:3"
	}
	if float64(height)/float64(width) > 1.4 {
		return "9:16"
	}
	return "3:4"
}

func parseWxH(size string) (int, int, bool) {
	parts := strings.Split(strings.ToLower(size), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, err1 := strconv.Atoi(parts[0])
	h, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}

func (a *TaskAdaptor) convertToVideoSubmitPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*videoSubmitRequest, error) {
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
	case "1280x720":
		return "720p", "16:9"
	case "720x1280":
		return "720p", "9:16"
	case "1920x1080", "1792x1024":
		return "1080p", "16:9"
	case "1080x1920", "1024x1792":
		return "1080p", "9:16"
	case "720x720", "1024x1024":
		return "720p", "1:1"
	}
	width, height, ok := parseWxH(size)
	if !ok {
		if strings.Contains(size, "1080") {
			return "1080p", "16:9"
		}
		return "720p", "16:9"
	}
	maxDim := width
	if height > maxDim {
		maxDim = height
	}
	if maxDim >= 1920 || (maxDim >= 1080 && (width == 1920 || height == 1920 || width == 1792 || height == 1792)) {
		return "1080p", ratioFromVideoDims(width, height)
	}
	if maxDim >= 1080 && (width == 1080 || height == 1080) {
		return "1080p", ratioFromVideoDims(width, height)
	}
	return "720p", ratioFromVideoDims(width, height)
}

func ratioFromVideoDims(width, height int) string {
	if width == height {
		return "1:1"
	}
	if width > height {
		aspect := float64(width) / float64(height)
		if aspect > 1.6 {
			return "16:9"
		}
		return "4:3"
	}
	aspect := float64(height) / float64(width)
	if aspect > 1.6 {
		return "9:16"
	}
	return "3:4"
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

	var envelope submitEnvelope
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
	path := videoSubmitPath
	action, _ := body["action"].(string)
	if action == constant.TaskActionImageGenerate ||
		strings.Contains(strings.ToLower(action), "image") ||
		strings.HasPrefix(taskID, "img_") {
		path = imageSubmitPath
	}
	uri := strings.TrimRight(baseURL, "/") + path + "/" + taskID
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
	poll, err := parsePollBody(respBody)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal basicrouter poll failed")
	}
	taskResult := &relaycommon.TaskInfo{Code: 0}
	status := strings.ToLower(poll.Data.Status)
	urls := extractImageURLs(poll.Data)
	errMsg := common.JsonRawMessageToString(poll.Data.ErrorMessage)
	switch status {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = taskcommon.ProgressQueued
	case "processing", "running", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressInProgress
	case "success", "succeeded", "completed":
		if poll.Data.VideoURL != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = taskcommon.ProgressComplete
			taskResult.Url = poll.Data.VideoURL
		} else if len(urls) > 0 {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = taskcommon.ProgressComplete
			taskResult.Url = urls[0]
		} else if errMsg != "" {
			taskResult.Status = model.TaskStatusFailure
			taskResult.Progress = taskcommon.ProgressComplete
			taskResult.Reason = errMsg
		} else {
			// Some providers flip to success a tick before URLs are attached.
			taskResult.Status = model.TaskStatusInProgress
			taskResult.Progress = taskcommon.ProgressInProgress
		}
	case "failed", "error", "cancelled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Reason = errMsg
		if taskResult.Reason == "" {
			taskResult.Reason = poll.Message
		}
		if taskResult.Reason == "" {
			taskResult.Reason = "generation failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressSubmitted
	}
	return taskResult, nil
}

func parsePollBody(respBody []byte) (pollEnvelope, error) {
	var poll pollEnvelope
	if err := common.Unmarshal(respBody, &poll); err != nil {
		return poll, err
	}
	if poll.Data.Status == "" && poll.Data.TaskID == "" {
		var inner pollData
		if err := common.Unmarshal(respBody, &inner); err == nil && (inner.Status != "" || inner.TaskID != "") {
			poll.Data = inner
		}
	}
	return poll, nil
}

func extractImageURLs(data pollData) []string {
	for _, raw := range []json.RawMessage{data.Images, data.ImageURLs, data.ImageURL, data.URL} {
		if urls := extractImageURLsFromRaw(raw); len(urls) > 0 {
			return urls
		}
	}
	return nil
}

func extractImageURLsFromRaw(raw json.RawMessage) []string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil
	}
	switch trimmed[0] {
	case '"':
		var s string
		if err := common.Unmarshal(trimmed, &s); err != nil {
			return nil
		}
		s = strings.TrimSpace(s)
		if s == "" {
			return nil
		}
		if isMediaURL(s) {
			return []string{s}
		}
		if s[0] == '[' || s[0] == '{' || s[0] == '"' {
			return extractImageURLsFromRaw(json.RawMessage(s))
		}
		return nil
	case '[':
		var asStrings []string
		if err := common.Unmarshal(trimmed, &asStrings); err == nil {
			return filterMediaURLs(asStrings)
		}
		var items []json.RawMessage
		if err := common.Unmarshal(trimmed, &items); err != nil {
			return nil
		}
		var out []string
		for _, item := range items {
			out = append(out, extractImageURLsFromRaw(item)...)
		}
		return out
	case '{':
		var obj map[string]json.RawMessage
		if err := common.Unmarshal(trimmed, &obj); err != nil {
			return nil
		}
		for _, key := range []string{"url", "imageUrl", "image_url", "src", "images", "imageUrls"} {
			if v, ok := obj[key]; ok {
				if urls := extractImageURLsFromRaw(v); len(urls) > 0 {
					return urls
				}
			}
		}
		return nil
	}
	s := strings.Trim(string(trimmed), `"'`)
	if isMediaURL(s) {
		return []string{s}
	}
	return nil
}

func parseImageURLList(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil, nil
	}
	urls := extractImageURLsFromRaw(json.RawMessage(raw))
	if len(urls) > 0 {
		return urls, nil
	}
	if raw == "[]" || raw == "\"[]\"" {
		return []string{}, nil
	}
	return nil, fmt.Errorf("invalid images field")
}

func filterMediaURLs(urls []string) []string {
	out := make([]string, 0, len(urls))
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if isMediaURL(u) {
			out = append(out, u)
		}
	}
	return out
}

func isMediaURL(u string) bool {
	return strings.HasPrefix(u, "http://") ||
		strings.HasPrefix(u, "https://") ||
		strings.HasPrefix(u, "data:image/")
}

func isVideoProxyURL(u string) bool {
	return strings.Contains(u, "/v1/videos/") && strings.Contains(u, "/content")
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

	var poll pollEnvelope
	if len(originTask.Data) > 0 {
		poll, _ = parsePollBody(originTask.Data)
		if poll.Data.VideoURL != "" {
			openAIVideo.SetMetadata("url", poll.Data.VideoURL)
		}
		if poll.Data.LastFrameURL != "" {
			openAIVideo.SetMetadata("last_frame_url", poll.Data.LastFrameURL)
		}
		if urls := extractImageURLs(poll.Data); len(urls) > 0 {
			openAIVideo.SetMetadata("images", urls)
			openAIVideo.SetMetadata("url", urls[0])
		}
		if text := common.JsonRawMessageToString(poll.Data.Text); text != "" {
			openAIVideo.SetMetadata("revised_prompt", text)
		}
		if originTask.Status == model.TaskStatusFailure {
			msg := common.JsonRawMessageToString(poll.Data.ErrorMessage)
			if msg == "" {
				msg = poll.Message
			}
			if msg == "" {
				msg = originTask.FailReason
			}
			code := "basicrouter_video_failed"
			if originTask.Action == constant.TaskActionImageGenerate {
				code = "basicrouter_image_failed"
			}
			openAIVideo.Error = &dto.OpenAIVideoError{
				Message: msg,
				Code:    code,
			}
		}
	}
	if resultURL := originTask.GetResultURL(); resultURL != "" && !isVideoProxyURL(resultURL) {
		if openAIVideo.Metadata == nil || openAIVideo.Metadata["url"] == nil {
			openAIVideo.SetMetadata("url", resultURL)
		}
	}
	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
