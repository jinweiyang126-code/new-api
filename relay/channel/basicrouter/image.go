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
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type imageSubmitRequest struct {
	Text       string   `json:"text"`
	Model      string   `json:"model"`
	ImageURLs  []string `json:"imageUrls,omitempty"`
	Count      int      `json:"count,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Ratio      string   `json:"ratio,omitempty"`
}

type apiEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    jsonRawOrObject `json:"data"`
}

// jsonRawOrObject accepts both {"taskId":"..."} and nested poll payloads.
type jsonRawOrObject struct {
	TaskID       string `json:"taskId"`
	Status       string `json:"status"`
	ErrorMessage string `json:"errorMessage"`
	Images       string `json:"images"`
	Text         string `json:"text"`
}

func convertOpenAIImageToBasicRouter(request dto.ImageRequest, upstreamModel string) imageSubmitRequest {
	modelName := upstreamModel
	if modelName == "" {
		modelName = request.Model
	}
	count := 1
	if request.N != nil && *request.N > 0 {
		count = int(*request.N)
	}
	return imageSubmitRequest{
		Text:       request.Prompt,
		Model:      modelName,
		Count:      count,
		Resolution: resolutionFromImageRequest(request),
		Ratio:      ratioFromImageRequest(request),
		ImageURLs:  []string{},
	}
}

func resolutionFromImageRequest(request dto.ImageRequest) string {
	quality := strings.ToLower(strings.TrimSpace(request.Quality))
	if strings.Contains(quality, "hd") || strings.Contains(quality, "2k") || quality == "high" {
		return "2k"
	}
	size := strings.ToLower(request.Size)
	if strings.Contains(size, "2048") || strings.Contains(size, "1792") {
		return "2k"
	}
	if size == "" {
		return defaultImageResolution
	}
	return "1k"
}

func ratioFromImageRequest(request dto.ImageRequest) string {
	if raw, ok := request.Extra["aspect_ratio"]; ok {
		var aspectRatio string
		if err := common.Unmarshal(raw, &aspectRatio); err == nil && aspectRatio != "" {
			return aspectRatio
		}
	}
	switch request.Size {
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
	width, height, ok := parseWxH(request.Size)
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

func submitAndPollImage(
	c *gin.Context,
	baseURL, apiKey, proxy string,
	payload imageSubmitRequest,
) (*dto.ImageResponse, error) {
	submitURL := strings.TrimRight(baseURL, "/") + imageSubmitPath
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, submitURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("http client: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("basicrouter image submit status %d: %s", resp.StatusCode, truncate(string(respBody), 512))
	}

	var envelope apiEnvelope
	if err := common.Unmarshal(respBody, &envelope); err != nil {
		return nil, fmt.Errorf("unmarshal submit response: %w", err)
	}
	if envelope.Code != 0 && envelope.Code != 200 {
		return nil, fmt.Errorf("basicrouter image submit failed: %s", envelope.Message)
	}
	taskID := envelope.Data.TaskID
	if taskID == "" {
		return nil, fmt.Errorf("basicrouter image taskId empty: %s", truncate(string(respBody), 512))
	}

	pollURL := strings.TrimRight(baseURL, "/") + imageSubmitPath + "/" + taskID
	for attempt := 0; attempt < imagePollMaxAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-c.Request.Context().Done():
				return nil, c.Request.Context().Err()
			case <-time.After(time.Duration(imagePollInterval) * time.Second):
			}
		}

		pollReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, pollURL, nil)
		if err != nil {
			return nil, err
		}
		pollReq.Header.Set("Authorization", "Bearer "+apiKey)
		pollReq.Header.Set("Accept", "application/json")
		pollResp, err := client.Do(pollReq)
		if err != nil {
			return nil, err
		}
		pollBody, err := io.ReadAll(pollResp.Body)
		_ = pollResp.Body.Close()
		if err != nil {
			return nil, err
		}
		if pollResp.StatusCode < 200 || pollResp.StatusCode >= 300 {
			return nil, fmt.Errorf("basicrouter image poll status %d: %s", pollResp.StatusCode, truncate(string(pollBody), 512))
		}

		var poll apiEnvelope
		if err := common.Unmarshal(pollBody, &poll); err != nil {
			return nil, fmt.Errorf("unmarshal poll response: %w", err)
		}
		status := strings.ToLower(poll.Data.Status)
		switch status {
		case "success", "succeeded", "completed":
			urls, err := parseImageURLList(poll.Data.Images)
			if err != nil {
				return nil, err
			}
			if len(urls) == 0 {
				return nil, fmt.Errorf("basicrouter image result empty")
			}
			out := &dto.ImageResponse{Created: time.Now().Unix()}
			for _, u := range urls {
				out.Data = append(out.Data, dto.ImageData{Url: u, RevisedPrompt: poll.Data.Text})
			}
			return out, nil
		case "failed", "error", "cancelled":
			msg := poll.Data.ErrorMessage
			if msg == "" {
				msg = poll.Message
			}
			if msg == "" {
				msg = "image generation failed"
			}
			return nil, fmt.Errorf("%s", msg)
		default:
			// pending / processing — keep polling
		}
	}
	return nil, fmt.Errorf("basicrouter image generation timed out")
}

func parseImageURLList(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	var urls []string
	if err := common.Unmarshal([]byte(raw), &urls); err == nil {
		return urls, nil
	}
	// Some gateways may already return a JSON array at the top level elsewhere;
	// fall back to single URL string.
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return []string{raw}, nil
	}
	return nil, fmt.Errorf("invalid images field: %s", truncate(raw, 256))
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
