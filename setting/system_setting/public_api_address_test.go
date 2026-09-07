package system_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetPublicApiAddressFallsBackToServerAddress(t *testing.T) {
	prevServer := ServerAddress
	prevPublic := PublicApiAddress
	t.Cleanup(func() {
		ServerAddress = prevServer
		PublicApiAddress = prevPublic
	})

	ServerAddress = "https://www.example.com/"
	PublicApiAddress = ""
	assert.Equal(t, "https://www.example.com", GetPublicApiAddress())

	PublicApiAddress = "https://api.example.com/"
	assert.Equal(t, "https://api.example.com", GetPublicApiAddress())
}
