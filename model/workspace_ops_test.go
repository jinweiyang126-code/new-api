package model

import (
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWorkspaceOpsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousRedis := common.RedisEnabled
	previousType := common.MainDatabaseType()
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1) // SQLite: serialize writers; conditional update still prevents oversell

	require.NoError(t, db.AutoMigrate(
		&User{}, &Customer{}, &Workspace{}, &CustomerMember{}, &WorkspaceMember{},
	))
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetMainDatabaseType(previousType)
		_ = sqlDB.Close()
	})
	return db
}

func seedCustomerWithQuota(t *testing.T, db *gorm.DB, quota int) (customerID, workspaceID, ownerID int) {
	t.Helper()
	owner := &User{
		Username: "ws-owner", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "ws-owner-aff",
	}
	require.NoError(t, db.Create(owner).Error)
	customer := &Customer{Name: "WS Co"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	if quota > 0 {
		_, err = TopUpCustomerQuota(customer.Id, quota)
		require.NoError(t, err)
	}
	return customer.Id, ws.Id, owner.Id
}

func TestTransferQuotaInsufficientLeavesPoolsUnchanged(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, workspaceID, _ := seedCustomerWithQuota(t, db, 100)

	_, _, err := TransferQuotaToWorkspace(workspaceID, 500)
	require.ErrorIs(t, err, ErrInsufficientCustomerQuota)

	customer, err := GetCustomerById(customerID)
	require.NoError(t, err)
	require.Equal(t, 100, customer.Quota)

	ws, err := GetWorkspaceById(workspaceID)
	require.NoError(t, err)
	require.Equal(t, 0, ws.Quota)
}

func TestTransferQuotaSuccess(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, workspaceID, _ := seedCustomerWithQuota(t, db, 1000)

	customer, ws, err := TransferQuotaToWorkspace(workspaceID, 400)
	require.NoError(t, err)
	require.Equal(t, 600, customer.Quota)
	require.Equal(t, 400, ws.Quota)

	customer, err = GetCustomerById(customerID)
	require.NoError(t, err)
	require.Equal(t, 600, customer.Quota)
	ws, err = GetWorkspaceById(workspaceID)
	require.NoError(t, err)
	require.Equal(t, 400, ws.Quota)
}

func TestTransferQuotaRejectsDisabledWorkspace(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, _, ownerID := seedCustomerWithQuota(t, db, 1000)

	extra, err := CreateWorkspace(customerID, "Team A", "team-a", ownerID)
	require.NoError(t, err)
	disabled := CustomerStatusDisabled
	_, err = UpdateWorkspaceFields(extra.Id, nil, &disabled)
	require.NoError(t, err)

	_, _, err = TransferQuotaToWorkspace(extra.Id, 100)
	require.ErrorIs(t, err, ErrWorkspaceDisabled)

	customer, err := GetCustomerById(customerID)
	require.NoError(t, err)
	require.Equal(t, 1000, customer.Quota)
}

func TestTransferQuotaConcurrentNoOversell(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, workspaceID, _ := seedCustomerWithQuota(t, db, 1000)

	const workers = 20
	const amount = 300
	var success int64
	var wg sync.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			_, _, err := TransferQuotaToWorkspace(workspaceID, amount)
			if err == nil {
				atomic.AddInt64(&success, 1)
			}
		}()
	}
	wg.Wait()

	require.Equal(t, int64(3), success, "only floor(1000/300)=3 transfers should succeed")

	customer, err := GetCustomerById(customerID)
	require.NoError(t, err)
	ws, err := GetWorkspaceById(workspaceID)
	require.NoError(t, err)
	require.Equal(t, 100, customer.Quota)
	require.Equal(t, 900, ws.Quota)
	require.Equal(t, 1000, customer.Quota+ws.Quota)
}

func TestCreateWorkspaceAndCannotDisableDefault(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, defaultID, ownerID := seedCustomerWithQuota(t, db, 0)

	ws, err := CreateWorkspace(customerID, "Eng", "eng", ownerID)
	require.NoError(t, err)
	require.Equal(t, "eng", ws.Slug)
	require.False(t, ws.IsDefault)

	var member WorkspaceMember
	require.NoError(t, db.Where("workspace_id = ? AND user_id = ?", ws.Id, ownerID).First(&member).Error)
	require.Equal(t, WorkspaceRoleAdmin, member.Role)

	disabled := CustomerStatusDisabled
	_, err = UpdateWorkspaceFields(defaultID, nil, &disabled)
	require.ErrorIs(t, err, ErrCannotDisableDefaultWorkspace)
}

func TestCreateWorkspaceAutoSlugWhenEmpty(t *testing.T) {
	db := setupWorkspaceOpsTestDB(t)
	customerID, _, ownerID := seedCustomerWithQuota(t, db, 0)

	ws, err := CreateWorkspace(customerID, "Visa Loyalty", "", ownerID)
	require.NoError(t, err)
	require.Equal(t, "visa-loyalty", ws.Slug)

	ws2, err := CreateWorkspace(customerID, "Visa Loyalty", "", ownerID)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(ws2.Slug, "visa-loyalty-"))
	require.NotEqual(t, ws.Slug, ws2.Slug)

	_, err = CreateWorkspace(customerID, "", "", ownerID)
	require.ErrorIs(t, err, ErrWorkspaceNameRequired)
}
