package common

import (
	"encoding/json"
)

// EnsureStreamIncludeUsageJSON forces stream_options.include_usage=true on a
// chat-completions JSON body when stream is enabled. Used for pass-through
// bodies that would otherwise skip ConvertOpenAIRequest and miss cache fields.
func EnsureStreamIncludeUsageJSON(body []byte) ([]byte, error) {
	if len(body) == 0 {
		return body, nil
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return body, err
	}
	stream, _ := payload["stream"].(bool)
	if !stream {
		return body, nil
	}
	opts, _ := payload["stream_options"].(map[string]any)
	if opts == nil {
		opts = map[string]any{}
	}
	opts["include_usage"] = true
	payload["stream_options"] = opts
	return json.Marshal(payload)
}
