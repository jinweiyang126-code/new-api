package basicrouter

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIImageToBasicRouter(t *testing.T) {
	n := uint(2)
	req := dto.ImageRequest{
		Model:   "seedream-4.5",
		Prompt:  "a cat",
		Size:    "1792x1024",
		Quality: "hd",
		N:       &n,
	}
	got := convertOpenAIImageToBasicRouter(req, "seedream-4.5")
	require.Equal(t, "a cat", got.Text)
	require.Equal(t, "seedream-4.5", got.Model)
	require.Equal(t, 2, got.Count)
	require.Equal(t, "2k", got.Resolution)
	require.Equal(t, "16:9", got.Ratio)
}

func TestParseImageURLList(t *testing.T) {
	urls, err := parseImageURLList(`["https://a/1.png","https://a/2.png"]`)
	require.NoError(t, err)
	require.Equal(t, []string{"https://a/1.png", "https://a/2.png"}, urls)
}
