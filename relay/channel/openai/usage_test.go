package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/stretchr/testify/require"
)

func TestApplyUsagePostProcessing_BasicRouterPromptCacheHitTokens(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeBasicRouter}}
	usage := &dto.Usage{
		PromptTokens:         1000,
		PromptCacheHitTokens: 800,
	}

	applyUsagePostProcessing(info, usage, nil)
	require.Equal(t, 800, usage.PromptTokensDetails.CachedTokens)
}

func TestApplyUsagePostProcessing_BasicRouterPromptTokensDetails(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeBasicRouter}}
	usage := &dto.Usage{PromptTokens: 1000}
	body := []byte(`{"usage":{"prompt_tokens":1000,"completion_tokens":10,"prompt_tokens_details":{"cached_tokens":750}}}`)

	applyUsagePostProcessing(info, usage, body)
	require.Equal(t, 750, usage.PromptTokensDetails.CachedTokens)
}

func TestApplyUsagePostProcessing_DeepSeekStillMapsCacheHit(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeDeepSeek}}
	usage := &dto.Usage{PromptCacheHitTokens: 321}

	applyUsagePostProcessing(info, usage, nil)
	require.Equal(t, 321, usage.PromptTokensDetails.CachedTokens)
}

func TestNormalizeOpenAICompatibleCachedTokens_PrefersExisting(t *testing.T) {
	usage := &dto.Usage{
		PromptCacheHitTokens: 100,
		PromptTokensDetails:  dto.InputTokenDetails{CachedTokens: 50},
	}
	normalizeOpenAICompatibleCachedTokens(usage, nil)
	require.Equal(t, 50, usage.PromptTokensDetails.CachedTokens)
}
