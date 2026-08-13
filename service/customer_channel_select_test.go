/*
Copyright (C) 2023-2026 QuantumNous
*/
package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomerChannelSelectDB(t *testing.T) {
	t.Helper()
	prev := model.DB
	prevSecret := common.CryptoSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Customer{},
		&model.Channel{},
		&model.CustomerChannelBinding{},
		&model.CustomerUpstreamCredential{},
		&model.Ability{},
	))
	model.DB = db
	common.CryptoSecret = "t15-channel-select-secret"
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = prev
		common.CryptoSecret = prevSecret
	})
}

func createCustomer(t *testing.T, c *model.Customer) *model.Customer {
	t.Helper()
	require.NoError(t, model.DB.Create(c).Error)
	// GORM may skip false zero-values on create when column has default:true.
	require.NoError(t, model.DB.Model(c).Updates(map[string]interface{}{
		"upstream_mode":          c.UpstreamMode,
		"allow_global_fallback":  c.AllowGlobalFallback,
		"byok_enabled":           c.ByokEnabled,
	}).Error)
	loaded, err := model.GetCustomerById(c.Id)
	require.NoError(t, err)
	return loaded
}

func newSelectCtx(customerId int) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyCustomerId, customerId)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	return c
}

func TestSelectChannelSharedCustomerUsesGlobalPath(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	c := createCustomer(t, &model.Customer{
		Name: "S", Slug: "s1", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeShared, AllowGlobalFallback: true, ByokEnabled: false,
	})
	// No abilities → global select returns nil without error; ensure no upstream_not_configured.
	ctx := newSelectCtx(c.Id)
	ch, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.NoError(t, err)
	require.Nil(t, ch)
	require.Equal(t, model.UpstreamSourceShared, common.GetContextKeyString(ctx, constant.ContextKeyUpstreamSource))
}

func TestSelectChannelDedicatedOnlyBoundChannel(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	cust := createCustomer(t, &model.Customer{
		Name: "D", Slug: "d1", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeDedicated, AllowGlobalFallback: false, ByokEnabled: false,
	})
	bound := &model.Channel{
		Id: 101, Type: constant.ChannelTypeOpenAI, Name: "bound", Key: "sk-bound",
		Status: common.ChannelStatusEnabled, Models: "gpt-4o-mini", Group: "default",
	}
	other := &model.Channel{
		Id: 202, Type: constant.ChannelTypeOpenAI, Name: "other", Key: "sk-other",
		Status: common.ChannelStatusEnabled, Models: "gpt-4o-mini", Group: "default",
	}
	require.NoError(t, model.DB.Create(bound).Error)
	require.NoError(t, model.DB.Create(other).Error)
	_, err := model.CreateCustomerChannelBinding(cust.Id, bound.Id, 10, "")
	require.NoError(t, err)

	ctx := newSelectCtx(cust.Id)
	ch, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, bound.Id, ch.Id)
	require.Equal(t, "customer", group)
	require.Equal(t, model.UpstreamSourceDedicated, common.GetContextKeyString(ctx, constant.ContextKeyUpstreamSource))
	require.NotEqual(t, other.Id, ch.Id)
}

func TestSelectChannelDedicatedNoFallbackErrors(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	cust := createCustomer(t, &model.Customer{
		Name: "D2", Slug: "d2", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeDedicated, AllowGlobalFallback: false,
	})
	ctx := newSelectCtx(cust.Id)
	_, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.ErrorIs(t, err, ErrUpstreamNotConfigured)
}

func TestSelectChannelByokUsesCustomerKey(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	cust := createCustomer(t, &model.Customer{
		Name: "B", Slug: "b1", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeByok, AllowGlobalFallback: false, ByokEnabled: true,
	})
	dto, err := model.CreateCustomerUpstreamCredential(cust.Id, 1, model.CreateUpstreamCredentialInput{
		Name: "my-openai", Type: "openai", Key: "sk-customer-byok-key",
		BaseURL: "https://example.com", Models: "gpt-4o-mini", Priority: 1,
	})
	require.NoError(t, err)

	ctx := newSelectCtx(cust.Id)
	ch, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, -dto.Id, ch.Id)
	require.Equal(t, "sk-customer-byok-key", ch.Key)
	require.Equal(t, "https://example.com", ch.GetBaseURL())
	require.Equal(t, model.UpstreamSourceByok, common.GetContextKeyString(ctx, constant.ContextKeyUpstreamSource))
	require.NotContains(t, ch.Key, "ciphertext")
}

func TestSelectChannelByokDisabledIgnoresCredentials(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	cust := createCustomer(t, &model.Customer{
		Name: "B2", Slug: "b2", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeByok, AllowGlobalFallback: false, ByokEnabled: true,
	})
	_, err := model.CreateCustomerUpstreamCredential(cust.Id, 1, model.CreateUpstreamCredentialInput{
		Name: "x", Type: "openai", Key: "sk-1", Models: "gpt-4o-mini",
	})
	require.NoError(t, err)
	// Turn off byok_enabled after credential exists.
	off := false
	_, err = model.UpdateCustomerUpstreamSettings(cust.Id, model.UpstreamModeByok, nil, &off)
	require.NoError(t, err)

	ctx := newSelectCtx(cust.Id)
	_, _, err = CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.ErrorIs(t, err, ErrUpstreamNotConfigured)
}

func TestPersonalTokenAlwaysSharedSource(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx, constant.ContextKeyCustomerId, 0)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	_, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx: ctx, TokenGroup: "default", ModelName: "gpt-4o-mini", RequestPath: "/v1/chat/completions",
		Retry: common.GetPointer(0),
	})
	require.NoError(t, err)
	require.Equal(t, model.UpstreamSourceShared, common.GetContextKeyString(ctx, constant.ContextKeyUpstreamSource))
}

func TestCustomerUsesScopedUpstream(t *testing.T) {
	setupCustomerChannelSelectDB(t)
	cust := createCustomer(t, &model.Customer{
		Name: "H", Slug: "h1", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeHybrid, ByokEnabled: true,
	})
	ctx := newSelectCtx(cust.Id)
	require.True(t, CustomerUsesScopedUpstream(ctx))

	shared := createCustomer(t, &model.Customer{
		Name: "H2", Slug: "h2", Status: model.CustomerStatusEnabled,
		UpstreamMode: model.UpstreamModeShared,
	})
	ctx2 := newSelectCtx(shared.Id)
	require.False(t, CustomerUsesScopedUpstream(ctx2))
}
