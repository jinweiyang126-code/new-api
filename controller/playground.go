package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

func playgroundSetup(c *gin.Context) *types.NewAPIError {
	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		return types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

func writePlaygroundSetupError(c *gin.Context, newAPIError *types.NewAPIError) {
	c.JSON(newAPIError.StatusCode, gin.H{
		"error": newAPIError.ToOpenAIError(),
	})
}

func Playground(c *gin.Context) {
	if newAPIError := playgroundSetup(c); newAPIError != nil {
		writePlaygroundSetupError(c, newAPIError)
		return
	}
	Relay(c, types.RelayFormatOpenAI)
}

func PlaygroundImage(c *gin.Context) {
	if newAPIError := playgroundSetup(c); newAPIError != nil {
		writePlaygroundSetupError(c, newAPIError)
		return
	}
	// BasicRouter image generation is async (upstream task + poll); avoid holding
	// the HTTP request open for minutes (gateway/client cancel → context canceled).
	if c.GetInt("channel_type") == constant.ChannelTypeBasicRouter {
		c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		RelayTask(c)
		return
	}
	Relay(c, types.RelayFormatOpenAIImage)
}

func PlaygroundImageFetch(c *gin.Context) {
	if newAPIError := playgroundSetup(c); newAPIError != nil {
		writePlaygroundSetupError(c, newAPIError)
		return
	}
	c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
	RelayTaskFetch(c)
}

func PlaygroundVideo(c *gin.Context) {
	if newAPIError := playgroundSetup(c); newAPIError != nil {
		writePlaygroundSetupError(c, newAPIError)
		return
	}
	RelayTask(c)
}

func PlaygroundVideoFetch(c *gin.Context) {
	if newAPIError := playgroundSetup(c); newAPIError != nil {
		writePlaygroundSetupError(c, newAPIError)
		return
	}
	RelayTaskFetch(c)
}
