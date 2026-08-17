package relay

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestBasicRouterAdaptorRegistration(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeBasicRouter)
	require.True(t, ok)
	require.Equal(t, constant.APITypeBasicRouter, apiType)

	adaptor := GetAdaptor(apiType)
	require.NotNil(t, adaptor)
	require.Equal(t, "basicrouter", adaptor.GetChannelName())

	taskAdaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBasicRouter)))
	require.NotNil(t, taskAdaptor)
	require.Equal(t, "basicrouter", taskAdaptor.GetChannelName())

	require.Equal(t, "https://api.basicrouter.ai/api", constant.ChannelBaseURLs[constant.ChannelTypeBasicRouter])
	require.Equal(t, "BasicRouter", constant.GetChannelTypeName(constant.ChannelTypeBasicRouter))
}
