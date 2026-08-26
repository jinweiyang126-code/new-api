package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomerAPITestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousRedis := common.RedisEnabled
	previousType := common.MainDatabaseType()
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&User{}, &Customer{}, &Workspace{}, &CustomerMember{}, &WorkspaceMember{}, &Log{},
		&OrganizationWallet{},
	))
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func TestCreateCustomerWithOwnerCreatesDefaultWorkspace(t *testing.T) {
	db := setupCustomerAPITestDB(t)

	owner := &User{
		Username: "owner1", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "owner1-aff",
	}
	require.NoError(t, db.Create(owner).Error)

	customer := &Customer{Name: "Acme Corp", Remark: "test"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	require.NotNil(t, ws)
	require.Equal(t, WorkspaceSlugDefault, ws.Slug)
	require.True(t, ws.IsDefault)
	require.Equal(t, customer.Id, ws.CustomerId)
	require.Equal(t, UpstreamModeShared, customer.UpstreamMode)

	var user User
	require.NoError(t, db.First(&user, owner.Id).Error)
	require.Equal(t, customer.Id, user.CustomerId)

	var member CustomerMember
	require.NoError(t, db.Where("customer_id = ? AND user_id = ?", customer.Id, owner.Id).First(&member).Error)
	require.Equal(t, CustomerRoleOwner, member.Role)

	var wsMember WorkspaceMember
	require.NoError(t, db.Where("workspace_id = ? AND user_id = ?", ws.Id, owner.Id).First(&wsMember).Error)
	require.Equal(t, WorkspaceRoleAdmin, wsMember.Role)
}

func TestCreateCustomerWithOwnerAllowsMultipleCustomers(t *testing.T) {
	db := setupCustomerAPITestDB(t)

	owner := &User{
		Username: "owner2", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "owner2-aff",
	}
	require.NoError(t, db.Create(owner).Error)

	_, err := CreateCustomerWithOwner(&Customer{Name: "First"}, owner.Id)
	require.NoError(t, err)

	second, err := CreateCustomerWithOwner(&Customer{Name: "Second"}, owner.Id)
	require.NoError(t, err)
	require.NotNil(t, second)

	memberships, err := ListUserCustomerMemberships(owner.Id)
	require.NoError(t, err)
	require.Len(t, memberships, 2)

	var user User
	require.NoError(t, db.Select("customer_id").Where("id = ?", owner.Id).First(&user).Error)
	require.Equal(t, second.CustomerId, user.CustomerId)
}

func TestGetAllCustomersIncludesOwnerUsername(t *testing.T) {
	db := setupCustomerAPITestDB(t)

	owner := &User{
		Username: "owner-list", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "owner-list-aff",
	}
	require.NoError(t, db.Create(owner).Error)
	customer := &Customer{Name: "List Co"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	list, total, err := GetAllCustomers(0, 20, "", -1, "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)
	require.Equal(t, "owner-list", list[0].OwnerUsername)
	require.Equal(t, owner.Id, list[0].OwnerUserId)
}

func TestTopUpCustomerQuota(t *testing.T) {
	db := setupCustomerAPITestDB(t)

	owner := &User{
		Username: "owner3", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "owner3-aff",
	}
	require.NoError(t, db.Create(owner).Error)
	customer := &Customer{Name: "Topup Co"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	updated, err := TopUpCustomerQuota(customer.Id, 1500)
	require.NoError(t, err)
	require.Equal(t, 1500, updated.Quota)

	updated, err = TopUpCustomerQuota(customer.Id, 500)
	require.NoError(t, err)
	require.Equal(t, 2000, updated.Quota)

	_, err = TopUpCustomerQuota(customer.Id, 0)
	require.ErrorIs(t, err, ErrInvalidTopupAmount)
	_, err = TopUpCustomerQuota(customer.Id, -1)
	require.ErrorIs(t, err, ErrInvalidTopupAmount)
}

func TestCustomerUsedQuotaComesFromWorkspaces(t *testing.T) {
	db := setupCustomerAPITestDB(t)

	owner := &User{
		Username: "owner-used", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "owner-used-aff",
	}
	require.NoError(t, db.Create(owner).Error)
	customer := &Customer{Name: "Used Co"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	require.NoError(t, db.Model(&Workspace{}).Where("id = ?", ws.Id).Update("used_quota", 12345).Error)

	view, err := GetCustomerViewById(customer.Id)
	require.NoError(t, err)
	require.Equal(t, 12345, view.UsedQuota)

	list, total, err := GetAllCustomers(0, 20, "", -1, "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Equal(t, 12345, list[0].UsedQuota)

	UpdateCustomerUsedQuota(customer.Id, 100)
	stored, err := GetCustomerById(customer.Id)
	require.NoError(t, err)
	require.Equal(t, 100, stored.UsedQuota)
}
