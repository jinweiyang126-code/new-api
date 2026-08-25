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

func seedCustomerWorkspace(t *testing.T, customerQuotaLimit, workspaceQuotaLimit int) (customerID, workspaceID int) {
	t.Helper()
	now := time.Now().Unix()
	customer := &model.Customer{
		Name:                "T08 Customer",
		Slug:                fmt.Sprintf("t08-%d-%d", now, workspaceQuotaLimit),
		Status:              model.CustomerStatusEnabled,
		Quota:               customerQuotaLimit,
		QuotaLimit:          customerQuotaLimit,
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
		Quota:      0,
		QuotaLimit: workspaceQuotaLimit,
		IsDefault:  true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, model.DB.Create(ws).Error)
	return customer.Id, ws.Id
}

func seedOrgWallet(t *testing.T, userId, customerId, workspaceId, balance int) {
	t.Helper()
	now := time.Now().Unix()
	require.NoError(t, model.DB.Create(&model.OrganizationWallet{
		UserId:      userId,
		CustomerId:  customerId,
		WorkspaceId: workspaceId,
		Balance:     balance,
		CreatedAt:   now,
		UpdatedAt:   now,
	}).Error)
}

func seedWorkspaceToken(t *testing.T, id, userId, customerId, workspaceId int, key string, remainQuota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Token{
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
	}).Error)
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

func orgWalletBalance(t *testing.T, userId, workspaceId int) int {
	t.Helper()
	q, err := model.GetOrgWalletBalance(userId, workspaceId)
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

func TestWorkspaceBillingDebitsOrgWalletNotUser(t *testing.T) {
	truncate(t)
	seedUser(t, 801, 50_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 50_000)
	seedOrgWallet(t, 801, customerID, workspaceID, 20_000)
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
	orgBefore := orgWalletBalance(t, 801, workspaceID)
	tokenBefore := tokenRemain(t, 8011)

	apiErr := PreConsumeBilling(c, 1_000, info)
	require.Nil(t, apiErr)
	require.Equal(t, BillingSourceWorkspace, info.BillingSource)
	require.Equal(t, userBefore, userQuota(t, 801))
	require.Equal(t, orgBefore-1_000, orgWalletBalance(t, 801, workspaceID))
	require.Equal(t, tokenBefore-1_000, tokenRemain(t, 8011))

	require.NoError(t, SettleBilling(c, info, 800))
	require.Equal(t, userBefore, userQuota(t, 801), "user wallet must stay unchanged")
	require.Equal(t, orgBefore-800, orgWalletBalance(t, 801, workspaceID))
	require.Equal(t, tokenBefore-800, tokenRemain(t, 8011))
}

func TestWorkspaceBillingRejectsInsufficientOrgWallet(t *testing.T) {
	truncate(t)
	seedUser(t, 802, 50_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 50_000)
	seedOrgWallet(t, 802, customerID, workspaceID, 0)
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
	require.Contains(t, apiErr.Error(), "组织钱包")
	require.Equal(t, 50_000, userQuota(t, 802))
	require.Equal(t, 0, orgWalletBalance(t, 802, workspaceID))
	require.Equal(t, 10_000, tokenRemain(t, 8021))
}

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

func TestWorkspaceBillingRefundRestoresOrgWalletAndToken(t *testing.T) {
	truncate(t)
	seedUser(t, 804, 40_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 50_000)
	seedOrgWallet(t, 804, customerID, workspaceID, 12_000)
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
	orgBefore := orgWalletBalance(t, 804, workspaceID)
	tokenBefore := tokenRemain(t, 8041)

	apiErr := PreConsumeBilling(c, 2_000, info)
	require.Nil(t, apiErr)
	require.Equal(t, orgBefore-2_000, orgWalletBalance(t, 804, workspaceID))
	require.Equal(t, tokenBefore-2_000, tokenRemain(t, 8041))

	require.NotNil(t, info.Billing)
	info.Billing.Refund(c)

	require.Equal(t, userBefore, userQuota(t, 804))
	require.Eventually(t, func() bool {
		return orgWalletBalance(t, 804, workspaceID) == orgBefore && tokenRemain(t, 8041) == tokenBefore
	}, 2*time.Second, 20*time.Millisecond, "async refund should restore org wallet and token remain")
}

func TestWorkspaceBillingRejectsDisabledWorkspace(t *testing.T) {
	truncate(t)
	seedUser(t, 805, 30_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 50_000)
	seedOrgWallet(t, 805, customerID, workspaceID, 8_000)
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
	require.Equal(t, 8_000, orgWalletBalance(t, 805, workspaceID))
	require.Equal(t, 5_000, tokenRemain(t, 8051))
}

func TestWorkspaceBillingSettleTopUp(t *testing.T) {
	truncate(t)
	seedUser(t, 806, 25_000)
	customerID, workspaceID := seedCustomerWorkspace(t, 100_000, 50_000)
	seedOrgWallet(t, 806, customerID, workspaceID, 15_000)
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
	require.Equal(t, 15_000-1_200, orgWalletBalance(t, 806, workspaceID))
	require.Equal(t, 12_000-1_200, tokenRemain(t, 8061))
}
