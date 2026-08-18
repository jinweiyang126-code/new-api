package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestModelMetaInfersVendorOutsideCatalog(t *testing.T) {
	meta := map[string]rankingModelMeta{
		"deepseek-v4-pro": {vendor: "DeepSeek", vendorIcon: "DeepSeek.Color"},
		"qwen3.7-max":     {vendor: rankingUnknownVendor},
		"listed-unknown":  {vendor: rankingUnknownVendor},
	}

	catalog := modelMeta("deepseek-v4-pro", meta)
	require.Equal(t, "DeepSeek", catalog.vendor)
	require.Equal(t, "DeepSeek.Color", catalog.vendorIcon)

	inferred := modelMeta("qwen3.7-max", meta)
	require.Equal(t, "阿里巴巴", inferred.vendor)
	require.Equal(t, "Qwen.Color", inferred.vendorIcon)

	listedUnknown := modelMeta("listed-unknown", meta)
	require.Equal(t, rankingByokVendor, listedUnknown.vendor)

	fallback := modelMeta("my-custom-model", meta)
	require.Equal(t, rankingByokVendor, fallback.vendor)
	require.Empty(t, fallback.vendorIcon)
}
