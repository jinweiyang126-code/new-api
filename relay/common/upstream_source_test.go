/*
Copyright (C) 2023-2026 QuantumNous
*/
package common_test

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenBaseRelayInfoReadsUpstreamSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyUserId, 1)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUpstreamSource, "byok")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-4o-mini")

	info := relaycommon.GenRelayInfoOpenAI(c, nil)
	require.NotNil(t, info)
	require.Equal(t, "byok", info.UpstreamSource)
}

func TestInitChannelMetaRefreshesUpstreamSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyChannelId, 11)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyUpstreamSource, "dedicated")

	info := &relaycommon.RelayInfo{UpstreamSource: "shared"}
	info.InitChannelMeta(c)
	require.Equal(t, "dedicated", info.UpstreamSource)
	require.NotNil(t, info.ChannelMeta)
	require.Equal(t, 11, info.ChannelMeta.ChannelId)
}
