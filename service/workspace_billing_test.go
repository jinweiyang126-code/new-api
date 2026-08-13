package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func seedCustomerWorkspace(t *testing.T, customerQuota, workspaceQuota int) (customerID, workspaceID int) {
	t.Helper()
	now := time.Now().Unix()
	customer := &model.Customer{
		Name:                "T08 Customer",
		Slug:                fmt.Sprintf("t08-%d-%d", now, workspaceQuota),
		Status:              model.CustomerStatusEnabled,
		Quota:               customerQuota,
		UpstreamMode:        model.UpstreamModeShared,
		AllowGlobalFallback: true,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	require.NoError(t, model.DB.Create(customer).Error)

	ws := &model.Workspace{
		CustomerId: customer.Id,
		Name:       "default",
		Slug:       model.WorkspaceSlugDefault,
		Status:     model.CustomerStatusEnabled,
		Quota:      workspaceQuota,
		IsDefault:  true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, model.DB.Create(ws).Error)
	return customer.Id, ws.Id
}

func seedWorkspaceToken(t *testing.T, id, userId, customerId, workspaceId int, key string, remainQuota int) {
	t.Helper()
	token := &model.Token{
		Id:             id,
		UserId:         userId,
		Key:            key,
		Name:           "ws_token",
		Status:         common.TokenStatusEnabled,
		RemainQuota:    remainQuota,
		UsedQuota:      0,
		CustomerId:     customerId,
		WorkspaceId:    workspaceId,
		UnlimitedQuota: false,
	}
	require.NoError(t, model.DB.Create(token).Error)
}

func ginTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func userQuota(t *testing.T, userId int) int {
	t.Helper()
	q, err := model.GetUserQuota(userId, true)
	require.NoError(t, err)
	return q
}

func workspaceQuota(t *testing.T, workspaceId int) int {
	t.Helper()
	q, err := model.GetWorkspaceQuota(workspaceId)
	require.NoError(t, err)
	return q
}

func tokenRemain(t *testing.T, tokenId int) int {
	t.Helper()
	var tok model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", tokenId).First(&tok).Error)
	return tok.RemainQuota
}

func walletOnlySetting() dto.UserSetting {
	return dto.UserSetting{BillingPreference: "wallet_only"}
}

// T08: workspace token debits workspace pool only; user wallet unchanged.
func TestWorkspaceBillingDebitsPoolNotUser(t *testing.T) {
	truncate(t)
	seedUser(t, 801, 50_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 20_000)
	seedWorkspaceToken(t, 8011, 801, customerID, workspaceID, "ws-token-8011", 10_000)

	c := ginTestContext(t)
	c.Set("token_quota", 10_000)

	info := &relaycommon.RelayInfo{
		UserId:          801,
		CustomerId:      customerID,
		WorkspaceId:     workspaceID,
		TokenId:         8011,
		TokenKey:        "ws-token-8011",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	userBefore := userQuota(t, 801)
	wsBefore := workspaceQuota(t, workspaceID)
	tokenBefore := tokenRemain(t, 8011)

	apiErr := PreConsumeBilling(c, 1_000, info)
	require.Nil(t, apiErr)
	require.Equal(t, BillingSourceWorkspace, info.BillingSource)
	require.Equal(t, userBefore, userQuota(t, 801))
	require.Equal(t, wsBefore-1_000, workspaceQuota(t, workspaceID))
	require.Equal(t, tokenBefore-1_000, tokenRemain(t, 8011))

	require.NoError(t, SettleBilling(c, info, 800))
	require.Equal(t, userBefore, userQuota(t, 801), "user wallet must stay unchanged")
	require.Equal(t, wsBefore-800, workspaceQuota(t, workspaceID))
	require.Equal(t, tokenBefore-800, tokenRemain(t, 8011))
}

// T08: workspace pool empty / insufficient => fail with clear error.
func TestWorkspaceBillingRejectsInsufficientPool(t *testing.T) {
	truncate(t)
	seedUser(t, 802, 50_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 0)
	seedWorkspaceToken(t, 8021, 802, customerID, workspaceID, "ws-token-8021", 10_000)

	c := ginTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          802,
		CustomerId:      customerID,
		WorkspaceId:     workspaceID,
		TokenId:         8021,
		TokenKey:        "ws-token-8021",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	apiErr := PreConsumeBilling(c, 100, info)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
	require.Contains(t, apiErr.Error(), "工作区额度不足")
	require.Equal(t, 50_000, userQuota(t, 802))
	require.Equal(t, 0, workspaceQuota(t, workspaceID))
	require.Equal(t, 10_000, tokenRemain(t, 8021))
}

// T08: personal token regression — still debits user wallet.
func TestPersonalTokenBillingRegression(t *testing.T) {
	truncate(t)
	seedUser(t, 803, 20_000)
	seedToken(t, 8031, 803, "personal-8031", 15_000)

	c := ginTestContext(t)
	c.Set("token_quota", 15_000)

	info := &relaycommon.RelayInfo{
		UserId:          803,
		TokenId:         8031,
		TokenKey:        "personal-8031",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	apiErr := PreConsumeBilling(c, 500, info)
	require.Nil(t, apiErr)
	require.Equal(t, BillingSourceWallet, info.BillingSource)
	require.Equal(t, 19_500, userQuota(t, 803))
	require.Equal(t, 14_500, tokenRemain(t, 8031))

	require.NoError(t, SettleBilling(c, info, 300))
	require.Equal(t, 19_700, userQuota(t, 803))
	require.Equal(t, 14_700, tokenRemain(t, 8031))
}

// T08: refund restores workspace pool + token remain; user wallet untouched.
func TestWorkspaceBillingRefundRestoresPoolAndToken(t *testing.T) {
	truncate(t)
	seedUser(t, 804, 40_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 12_000)
	seedWorkspaceToken(t, 8041, 804, customerID, workspaceID, "ws-token-8041", 9_000)

	c := ginTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          804,
		CustomerId:      customerID,
		WorkspaceId:     workspaceID,
		TokenId:         8041,
		TokenKey:        "ws-token-8041",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	userBefore := userQuota(t, 804)
	wsBefore := workspaceQuota(t, workspaceID)
	tokenBefore := tokenRemain(t, 8041)

	apiErr := PreConsumeBilling(c, 2_000, info)
	require.Nil(t, apiErr)
	require.Equal(t, wsBefore-2_000, workspaceQuota(t, workspaceID))
	require.Equal(t, tokenBefore-2_000, tokenRemain(t, 8041))

	require.NotNil(t, info.Billing)
	info.Billing.Refund(c)

	require.Equal(t, userBefore, userQuota(t, 804))
	require.Eventually(t, func() bool {
		return workspaceQuota(t, workspaceID) == wsBefore && tokenRemain(t, 8041) == tokenBefore
	}, 2*time.Second, 20*time.Millisecond, "async refund should restore workspace pool and token remain")
}

// T08: disabled workspace rejected before debit.
func TestWorkspaceBillingRejectsDisabledWorkspace(t *testing.T) {
	truncate(t)
	seedUser(t, 805, 30_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 8_000)
	require.NoError(t, model.DB.Model(&model.Workspace{}).Where("id = ?", workspaceID).
		Update("status", model.CustomerStatusDisabled).Error)
	seedWorkspaceToken(t, 8051, 805, customerID, workspaceID, "ws-token-8051", 5_000)

	c := ginTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          805,
		CustomerId:      customerID,
		WorkspaceId:     workspaceID,
		TokenId:         8051,
		TokenKey:        "ws-token-8051",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	apiErr := PreConsumeBilling(c, 100, info)
	require.NotNil(t, apiErr)
	require.Contains(t, apiErr.Error(), "工作区已停用")
	require.Equal(t, 30_000, userQuota(t, 805))
	require.Equal(t, 8_000, workspaceQuota(t, workspaceID))
	require.Equal(t, 5_000, tokenRemain(t, 8051))
}

// Extra settle path: actual > preconsume top-up from workspace pool.
func TestWorkspaceBillingSettleTopUp(t *testing.T) {
	truncate(t)
	seedUser(t, 806, 25_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 15_000)
	seedWorkspaceToken(t, 8061, 806, customerID, workspaceID, "ws-token-8061", 12_000)

	c := ginTestContext(t)
	info := &relaycommon.RelayInfo{
		UserId:          806,
		CustomerId:      customerID,
		WorkspaceId:     workspaceID,
		TokenId:         8061,
		TokenKey:        "ws-token-8061",
		ForcePreConsume: true,
		UserSetting:     walletOnlySetting(),
	}

	userBefore := userQuota(t, 806)
	require.Nil(t, PreConsumeBilling(c, 500, info))
	require.NoError(t, SettleBilling(c, info, 1_200))
	require.Equal(t, userBefore, userQuota(t, 806))
	require.Equal(t, 15_000-1_200, workspaceQuota(t, workspaceID))
	require.Equal(t, 12_000-1_200, tokenRemain(t, 8061))
}
