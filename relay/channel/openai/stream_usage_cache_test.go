package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestMaybeCaptureStreamUsageWithCache(t *testing.T) {
	var best *dto.Usage
	var bestData string

	maybeCaptureStreamUsageWithCache(
		`{"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105}}`,
		&best, &bestData)
	require.Nil(t, best)

	maybeCaptureStreamUsageWithCache(
		`{"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"prompt_cache_hit_tokens":80}}`,
		&best, &bestData)
	require.NotNil(t, best)
	require.Equal(t, 80, best.PromptCacheHitTokens)

	maybeCaptureStreamUsageWithCache(
		`{"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"prompt_cache_hit_tokens":90}}`,
		&best, &bestData)
	require.Equal(t, 90, best.PromptCacheHitTokens)
}

func TestMergeStreamUsageCache(t *testing.T) {
	dst := &dto.Usage{PromptTokens: 100, CompletionTokens: 5}
	src := &dto.Usage{PromptCacheHitTokens: 80, PromptTokensDetails: dto.InputTokenDetails{CachedTokens: 80}}
	mergeStreamUsageCache(dst, src)
	require.Equal(t, 80, dst.PromptCacheHitTokens)
	require.Equal(t, 80, dst.PromptTokensDetails.CachedTokens)
}
