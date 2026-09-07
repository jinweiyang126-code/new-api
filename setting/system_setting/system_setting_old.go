package system_setting

import "strings"

var ServerAddress = "https://token.abcyjw.me"

// PublicApiAddress is the base URL for model relay (/v1) shown to clients.
// Empty means fall back to ServerAddress (same-origin / single-domain deploy).
var PublicApiAddress = ""

var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false

// GetPublicApiAddress returns the preferred relay base URL without trailing slash.
func GetPublicApiAddress() string {
	addr := strings.TrimSpace(PublicApiAddress)
	if addr == "" {
		addr = strings.TrimSpace(ServerAddress)
	}
	return strings.TrimRight(addr, "/")
}

func EnableWorker() bool {
	return WorkerUrl != ""
}
