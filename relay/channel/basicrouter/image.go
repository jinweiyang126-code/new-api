package basicrouter

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

type imageSubmitRequest struct {
	Text       string   `json:"text"`
	Model      string   `json:"model"`
	ImageURLs  []string `json:"imageUrls,omitempty"`
	Count      int      `json:"count,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Ratio      string   `json:"ratio,omitempty"`
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

func parseImageURLList(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	var urls []string
	if err := common.Unmarshal([]byte(raw), &urls); err == nil {
		return urls, nil
	}
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
