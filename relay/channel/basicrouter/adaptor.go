package basicrouter

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	proxy string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if info != nil && info.ChannelSetting.Proxy != "" {
		a.proxy = info.ChannelSetting.Proxy
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base := strings.TrimRight(info.ChannelBaseUrl, "/")
	if base == "" {
		base = defaultBaseURL
	}
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		return base + imageSubmitPath, nil
	case relayconstant.RelayModeChatCompletions:
		return base + "/v1/chat/completions", nil
	case relayconstant.RelayModeCompletions:
		return base + "/v1/completions", nil
	case relayconstant.RelayModeEmbeddings:
		return base + "/v1/embeddings", nil
	default:
		return "", fmt.Errorf("basicrouter unsupported relay mode: %d", info.RelayMode)
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("basicrouter does not support anthropic format via this adaptor")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("basicrouter does not support gemini format via this adaptor")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return nil, fmt.Errorf("unsupported image relay mode: %d", info.RelayMode)
	}
	upstream := info.UpstreamModelName
	if upstream == "" {
		upstream = request.Model
	}
	return convertOpenAIImageToBasicRouter(request, upstream), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == relayconstant.RelayModeImagesGenerations {
		return nil, errors.New("basicrouter image generation is async; use task submit (/pg|/v1 images/generations) and poll by task id")
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == relayconstant.RelayModeImagesGenerations {
		return openaiImagePassthrough(c, resp, info)
	}
	oa := openai.Adaptor{}
	return oa.DoResponse(c, resp, info)
}

func openaiImagePassthrough(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewError(readErr, types.ErrorCodeReadResponseBodyFailed)
	}
	_ = resp.Body.Close()

	var imageResp dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.JSON(http.StatusOK, imageResp)
	n := len(imageResp.Data)
	if n == 0 {
		n = 1
	}
	return &dto.Usage{
		PromptTokens:     1,
		CompletionTokens: n,
		TotalTokens:      1 + n,
	}, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
