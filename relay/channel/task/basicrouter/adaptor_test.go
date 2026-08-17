package basicrouter

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMapVideoSize(t *testing.T) {
	res, ratio := mapVideoSize("720x1280")
	require.Equal(t, "1080p", res)
	require.Equal(t, "9:16", ratio)

	res, ratio = mapVideoSize("1792x1024")
	require.Equal(t, "1080p", res)
	require.Equal(t, "16:9", ratio)
}
