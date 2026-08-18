package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInferDefaultVendor(t *testing.T) {
	vendor, icon := InferDefaultVendor("qwen3.7-max")
	require.Equal(t, "阿里巴巴", vendor)
	require.Equal(t, "Qwen.Color", icon)

	vendor, icon = InferDefaultVendor("alibaba/qwen3.7-max")
	require.Equal(t, "阿里巴巴", vendor)
	require.Equal(t, "Qwen.Color", icon)

	vendor, icon = InferDefaultVendor("deepseek-v4-pro")
	require.Equal(t, "DeepSeek", vendor)
	require.Equal(t, "DeepSeek.Color", icon)

	vendor, _ = InferDefaultVendor("seedream-5.0")
	require.Equal(t, "字节跳动", vendor)

	vendor, icon = InferDefaultVendor("my-custom-model")
	require.Empty(t, vendor)
	require.Empty(t, icon)
}
