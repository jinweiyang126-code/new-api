package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPath2RelayMode(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/v1/alpha/search", want: RelayModeAlphaSearch},
		{path: "/v1/alpha/search?foo=1", want: RelayModeAlphaSearch},
		{path: "/pg/images/generations", want: RelayModeImagesGenerations},
		{path: "/v1/images/generations", want: RelayModeImagesGenerations},
		{path: "/pg/images/generations/task_abc", want: RelayModeVideoFetchByID},
		{path: "/v1/images/generations/task_abc", want: RelayModeVideoFetchByID},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.want, Path2RelayMode(tt.path))
		})
	}
}
