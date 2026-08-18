package basicrouter

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestMapVideoSize(t *testing.T) {
	res, ratio := mapVideoSize("1280x720")
	require.Equal(t, "720p", res)
	require.Equal(t, "16:9", ratio)

	res, ratio = mapVideoSize("720x1280")
	require.Equal(t, "720p", res)
	require.Equal(t, "9:16", ratio)

	res, ratio = mapVideoSize("1920x1080")
	require.Equal(t, "1080p", res)
	require.Equal(t, "16:9", ratio)

	res, ratio = mapVideoSize("1080x1920")
	require.Equal(t, "1080p", res)
	require.Equal(t, "9:16", ratio)

	res, ratio = mapVideoSize("720x720")
	require.Equal(t, "720p", res)
	require.Equal(t, "1:1", ratio)

	res, ratio = mapVideoSize("1792x1024")
	require.Equal(t, "1080p", res)
	require.Equal(t, "16:9", ratio)
}

func TestParseImageURLList(t *testing.T) {
	urls, err := parseImageURLList(`["https://a/1.png","https://a/2.png"]`)
	require.NoError(t, err)
	require.Equal(t, []string{"https://a/1.png", "https://a/2.png"}, urls)

	urls, err = parseImageURLList("https://a/single.png")
	require.NoError(t, err)
	require.Equal(t, []string{"https://a/single.png"}, urls)
}

func TestRatioFromSize(t *testing.T) {
	require.Equal(t, "16:9", ratioFromSize("1792x1024"))
	require.Equal(t, "1:1", ratioFromSize("1024x1024"))
}

func TestParseTaskResultImageSuccess(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":0,"message":"ok","data":{"taskId":"u1","status":"success","images":"[\"https://cdn/a.png\",\"https://cdn/b.png\"]"}}`)
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, "SUCCESS", string(info.Status))
	require.Equal(t, "https://cdn/a.png", info.Url)
}

func TestParseTaskResultImageSuccessArray(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":200,"message":"success","data":{"taskId":"u1","status":"success","errorMessage":null,"images":["https://cdn/a.png"],"text":null}}`)
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, "SUCCESS", string(info.Status))
	require.Equal(t, "https://cdn/a.png", info.Url)
}

func TestParseTaskResultImageSuccessWaitsForURLs(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":200,"data":{"taskId":"u1","status":"success","images":null}}`)
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, "IN_PROGRESS", info.Status)
}

func TestConvertToOpenAIVideoImageMetadata(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_local",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Action:   constant.TaskActionImageGenerate,
		Data:     []byte(`{"code":0,"data":{"status":"success","images":"[\"https://cdn/a.png\"]","text":"a cat"}}`),
	}
	task.Properties.OriginModelName = "seedream-4.5"
	raw, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var ov map[string]any
	require.NoError(t, json.Unmarshal(raw, &ov))
	require.Equal(t, "completed", ov["status"])
	meta, ok := ov["metadata"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "https://cdn/a.png", meta["url"])
	images, ok := meta["images"].([]any)
	require.True(t, ok)
	require.Equal(t, "https://cdn/a.png", images[0])
}

func TestConvertToOpenAIVideoImageMetadataArray(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_local",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Action:   constant.TaskActionImageGenerate,
		Data:     []byte(`{"code":200,"data":{"status":"success","images":["https://cdn/a.png"],"text":null}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var ov map[string]any
	require.NoError(t, json.Unmarshal(raw, &ov))
	meta, ok := ov["metadata"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "https://cdn/a.png", meta["url"])
	images, ok := meta["images"].([]any)
	require.True(t, ok)
	require.Equal(t, "https://cdn/a.png", images[0])
}

func TestImageSubmitOmitsEmptyImageURLs(t *testing.T) {
	a := &TaskAdaptor{}
	payload, err := a.convertToImageSubmitPayload(&relaycommon.TaskSubmitReq{
		Prompt:   "太阳落山",
		Model:    "seedream-5.0",
		Size:     "2048x1152",
		Metadata: map[string]any{"count": 1},
	}, &relaycommon.RelayInfo{
		OriginModelName: "seedream-5.0",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "seedream-5.0"},
	})
	require.NoError(t, err)
	raw, err := json.Marshal(payload)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "imageUrls")
	require.Contains(t, string(raw), `"resolution":"2k"`)
	require.Contains(t, string(raw), `"ratio":"16:9"`)
}
