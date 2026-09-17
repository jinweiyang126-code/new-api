package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestBasicRouterSupportsStreamOptions(t *testing.T) {
	require.True(t, streamSupportedChannels[constant.ChannelTypeBasicRouter],
		"BasicRouter must request stream_options.include_usage so cache hit tokens are billed")
}
