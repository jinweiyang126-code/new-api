package model

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupLogIsolationDB(t *testing.T) {
	t.Helper()
	prevDB, prevLogDB := DB, LOG_DB
	prevRedis := common.RedisEnabled
	prevLogConsume := common.LogConsumeEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	InitColumnNames()
	common.RedisEnabled = false
	common.LogConsumeEnabled = true
	require.NoError(t, db.AutoMigrate(
		&User{}, &Customer{}, &Workspace{}, &CustomerMember{}, &WorkspaceMember{}, &Log{}, &Token{},
		&OrganizationWallet{},
	))
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = prevDB, prevLogDB
		common.RedisEnabled = prevRedis
		common.LogConsumeEnabled = prevLogConsume
	})
}

func seedLogIsoUser(t *testing.T, name string, customerId int) *User {
	t.Helper()
	u := &User{
		Username: name, Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: name + "-aff", CustomerId: customerId,
	}
	require.NoError(t, DB.Create(u).Error)
	return u
}

func TestRecordConsumeLogWritesCustomerWorkspace(t *testing.T) {
	setupLogIsolationDB(t)
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/", nil)
	c.Set("username", "ws-user")
	common.SetContextKey(c, constant.ContextKeyCustomerId, 11)
	common.SetContextKey(c, constant.ContextKeyWorkspaceId, 22)

	user := seedLogIsoUser(t, "ws-user", 11)
	RecordConsumeLog(c, user.Id, RecordConsumeLogParams{
		ChannelId: 1, ModelName: "gpt-test", TokenName: "t", Quota: 100,
		CustomerId: 11, WorkspaceId: 22,
	})

	var log Log
	require.NoError(t, LOG_DB.Where("user_id = ?", user.Id).First(&log).Error)
	require.Equal(t, 11, log.CustomerId)
	require.Equal(t, 22, log.WorkspaceId)
	require.Equal(t, 100, log.Quota)
}

func TestRecordConsumeLogFallsBackToContextTenant(t *testing.T) {
	setupLogIsolationDB(t)
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/", nil)
	c.Set("username", "ctx-user")
	common.SetContextKey(c, constant.ContextKeyCustomerId, 7)
	common.SetContextKey(c, constant.ContextKeyWorkspaceId, 8)

	user := seedLogIsoUser(t, "ctx-user", 7)
	RecordConsumeLog(c, user.Id, RecordConsumeLogParams{
		ChannelId: 1, ModelName: "gpt-test", TokenName: "t", Quota: 50,
	})

	var log Log
	require.NoError(t, LOG_DB.Where("user_id = ?", user.Id).First(&log).Error)
	require.Equal(t, 7, log.CustomerId)
	require.Equal(t, 8, log.WorkspaceId)
}

func TestCustomerAdminCannotSeeOtherCustomerLogs(t *testing.T) {
	setupLogIsolationDB(t)
	now := time.Now().Unix()

	ownerA := seedLogIsoUser(t, "owner-a", 0)
	ownerB := seedLogIsoUser(t, "owner-b", 0)
	custA := &Customer{Name: "A", Slug: "loga-" + ownerA.Username, Status: CustomerStatusEnabled, OwnerUserId: ownerA.Id, UpstreamMode: UpstreamModeShared, CreatedAt: now, UpdatedAt: now}
	custB := &Customer{Name: "B", Slug: "logb-" + ownerB.Username, Status: CustomerStatusEnabled, OwnerUserId: ownerB.Id, UpstreamMode: UpstreamModeShared, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, DB.Create(custA).Error)
	require.NoError(t, DB.Create(custB).Error)
	require.NoError(t, DB.Model(ownerA).Update("customer_id", custA.Id).Error)
	require.NoError(t, DB.Model(ownerB).Update("customer_id", custB.Id).Error)
	require.NoError(t, DB.Create(&CustomerMember{
		CustomerId: custA.Id, UserId: ownerA.Id, Role: CustomerRoleOwner, Status: MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)
	require.NoError(t, DB.Create(&CustomerMember{
		CustomerId: custB.Id, UserId: ownerB.Id, Role: CustomerRoleOwner, Status: MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)

	wsA := &Workspace{CustomerId: custA.Id, Name: "a", Slug: "default", Status: CustomerStatusEnabled, IsDefault: true, CreatedAt: now, UpdatedAt: now}
	wsB := &Workspace{CustomerId: custB.Id, Name: "b", Slug: "default", Status: CustomerStatusEnabled, IsDefault: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, DB.Create(wsA).Error)
	require.NoError(t, DB.Create(wsB).Error)

	require.NoError(t, createLog(&Log{
		UserId: ownerA.Id, Username: "owner-a", CreatedAt: now, Type: LogTypeConsume,
		Quota: 10, CustomerId: custA.Id, WorkspaceId: wsA.Id, ModelName: "m",
	}))
	require.NoError(t, createLog(&Log{
		UserId: ownerB.Id, Username: "owner-b", CreatedAt: now, Type: LogTypeConsume,
		Quota: 99, CustomerId: custB.Id, WorkspaceId: wsB.Id, ModelName: "m",
	}))

	// A admin with forced customer scope sees only A
	logs, total, err := GetLogsForViewer(LogAccessScope{CustomerId: custA.Id}, LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, logs, 1)
	require.Equal(t, custA.Id, logs[0].CustomerId)
	require.Equal(t, 10, logs[0].Quota)

	// Forged empty scope yields nothing
	logs, total, err = GetLogsForViewer(LogAccessScope{Empty: true}, LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(0), total)
	require.Len(t, logs, 0)
}
