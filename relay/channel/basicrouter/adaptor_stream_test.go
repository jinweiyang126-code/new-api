package basicrouter

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIRequest_ForcesIncludeUsageOnStream(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{IsStream: true}
	req := &dto.GeneralOpenAIRequest{Model: "deepseek-v4-pro", Stream: boolPtr(true)}

	out, err := a.ConvertOpenAIRequest(nil, info, req)
	require.NoError(t, err)
	got, ok := out.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.NotNil(t, got.StreamOptions)
	require.True(t, got.StreamOptions.IncludeUsage)
}

func boolPtr(v bool) *bool { return &v }
