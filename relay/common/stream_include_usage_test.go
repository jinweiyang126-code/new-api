package common

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEnsureStreamIncludeUsageJSON_AddsOptions(t *testing.T) {
	in := []byte(`{"model":"deepseek-v4-pro","stream":true,"messages":[]}`)
	out, err := EnsureStreamIncludeUsageJSON(in)
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(out, &payload))
	opts, ok := payload["stream_options"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, opts["include_usage"])
}

func TestEnsureStreamIncludeUsageJSON_MergesExisting(t *testing.T) {
	in := []byte(`{"stream":true,"stream_options":{"include_obfuscation":false}}`)
	out, err := EnsureStreamIncludeUsageJSON(in)
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(out, &payload))
	opts := payload["stream_options"].(map[string]any)
	require.Equal(t, true, opts["include_usage"])
	require.Equal(t, false, opts["include_obfuscation"])
}

func TestEnsureStreamIncludeUsageJSON_NoopWhenNotStream(t *testing.T) {
	in := []byte(`{"stream":false,"messages":[]}`)
	out, err := EnsureStreamIncludeUsageJSON(in)
	require.NoError(t, err)
	require.JSONEq(t, string(in), string(out))
}
