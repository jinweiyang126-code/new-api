package openai

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

func applyUsagePostProcessing(info *relaycommon.RelayInfo, usage *dto.Usage, responseBody []byte) {
	if info == nil || usage == nil {
		return
	}

	// OpenAI-compatible upstreams (incl. BasicRouter wrapping DeepSeek) often expose
	// cache hits as prompt_cache_hit_tokens / prompt_tokens_details.cached_tokens.
	// Normalize before channel-specific fallbacks so cache_ratio billing can apply.
	normalizeOpenAICompatibleCachedTokens(usage, responseBody)

	switch info.ChannelType {
	case constant.ChannelTypeMoonshot:
		// Moonshot的cached_tokens在非标准位置: choices[].usage.cached_tokens
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if cachedTokens, ok := extractMoonshotCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			}
		}
	case constant.ChannelTypeOpenAI:
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if cachedTokens, ok := extractLlamaCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			}
		}
	}
}

// normalizeOpenAICompatibleCachedTokens fills PromptTokensDetails.CachedTokens from
// common OpenAI / DeepSeek-shaped usage fields when still unset.
func normalizeOpenAICompatibleCachedTokens(usage *dto.Usage, responseBody []byte) {
	if usage.PromptTokensDetails.CachedTokens > 0 {
		return
	}
	if usage.InputTokensDetails != nil && usage.InputTokensDetails.CachedTokens > 0 {
		usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
		return
	}
	if usage.PromptCacheHitTokens > 0 {
		usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
		return
	}
	if cachedTokens, ok := extractCachedTokensFromBody(responseBody); ok {
		usage.PromptTokensDetails.CachedTokens = cachedTokens
	}
}

func extractCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Usage struct {
			PromptTokensDetails struct {
				CachedTokens    *int `json:"cached_tokens"`
				CacheReadTokens *int `json:"cache_read_tokens"`
			} `json:"prompt_tokens_details"`
			CachedTokens           *int `json:"cached_tokens"`
			PromptCacheHitTokens   *int `json:"prompt_cache_hit_tokens"`
			CacheReadInputTokens   *int `json:"cache_read_input_tokens"`
			CacheReadTokens        *int `json:"cache_read_tokens"`
		} `json:"usage"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Usage.PromptTokensDetails.CachedTokens != nil {
		return *payload.Usage.PromptTokensDetails.CachedTokens, true
	}
	if payload.Usage.PromptTokensDetails.CacheReadTokens != nil {
		return *payload.Usage.PromptTokensDetails.CacheReadTokens, true
	}
	if payload.Usage.CachedTokens != nil {
		return *payload.Usage.CachedTokens, true
	}
	if payload.Usage.PromptCacheHitTokens != nil {
		return *payload.Usage.PromptCacheHitTokens, true
	}
	if payload.Usage.CacheReadInputTokens != nil {
		return *payload.Usage.CacheReadInputTokens, true
	}
	if payload.Usage.CacheReadTokens != nil {
		return *payload.Usage.CacheReadTokens, true
	}
	return 0, false
}

// extractMoonshotCachedTokensFromBody 从Moonshot的非标准位置提取cached_tokens
// Moonshot的流式响应格式: {"choices":[{"usage":{"cached_tokens":111}}]}
func extractMoonshotCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Choices []struct {
			Usage struct {
				CachedTokens *int `json:"cached_tokens"`
			} `json:"usage"`
		} `json:"choices"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	// 遍历choices查找cached_tokens
	for _, choice := range payload.Choices {
		if choice.Usage.CachedTokens != nil && *choice.Usage.CachedTokens > 0 {
			return *choice.Usage.CachedTokens, true
		}
	}

	return 0, false
}

// extractLlamaCachedTokensFromBody 从llama.cpp的非标准位置提取cache_n
func extractLlamaCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Timings struct {
			CachedTokens *int `json:"cache_n"`
		} `json:"timings"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Timings.CachedTokens == nil {
		return 0, false
	}
	return *payload.Timings.CachedTokens, true
}
