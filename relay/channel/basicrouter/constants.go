package basicrouter

var ModelList = []string{
	"seedream-4.5",
	"seedance-2.0",
}

var ChannelName = "basicrouter"

const (
	defaultBaseURL         = "https://api.basicrouter.ai/api"
	imageSubmitPath        = "/v1/image-generations"
	videoSubmitPath        = "/v1/video-generations"
	defaultImageResolution = "2k"
	defaultImageRatio      = "1:1"
	defaultVideoTypeText2V = 1
)
