package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestEndpointTypesForBasicRouter(t *testing.T) {
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeImageGeneration, constant.EndpointTypeOpenAI},
		GetEndpointTypesByChannelType(constant.ChannelTypeBasicRouter, "seedream-4.5"),
	)
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAIVideo},
		GetEndpointTypesByChannelType(constant.ChannelTypeBasicRouter, "seedance-2.0"),
	)
}
