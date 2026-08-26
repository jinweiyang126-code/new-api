package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupLogAccessDB(t *testing.T) {
	t.Helper()
	prev := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Customer{}, &model.Workspace{},
		&model.CustomerMember{}, &model.WorkspaceMember{},
		&model.OrganizationWallet{},
	))
	model.DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	model.InitColumnNames()
	t.Cleanup(func() { model.DB = prev })
}

func createLogAccessUser(t *testing.T, name string) *model.User {
	t.Helper()
	u := &model.User{
		Username: name, Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name + "-aff",
	}
	require.NoError(t, model.DB.Create(u).Error)
	return u
}

func TestResolveSelfLogAccessScopeCustomerAdminIsolation(t *testing.T) {
	setupLogAccessDB(t)
	now := time.Now().Unix()
	ownerA := createLogAccessUser(t, "la-owner-a")
	ownerB := createLogAccessUser(t, "la-owner-b")
	custA := &model.Customer{Name: "CA", Slug: "ca-" + ownerA.Username, Status: model.CustomerStatusEnabled, OwnerUserId: ownerA.Id, UpstreamMode: model.UpstreamModeShared, CreatedAt: now, UpdatedAt: now}
	custB := &model.Customer{Name: "CB", Slug: "cb-" + ownerB.Username, Status: model.CustomerStatusEnabled, OwnerUserId: ownerB.Id, UpstreamMode: model.UpstreamModeShared, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, model.DB.Create(custA).Error)
	require.NoError(t, model.DB.Create(custB).Error)
	require.NoError(t, model.DB.Model(ownerA).Update("customer_id", custA.Id).Error)
	require.NoError(t, model.DB.Model(ownerB).Update("customer_id", custB.Id).Error)
	require.NoError(t, model.DB.Create(&model.CustomerMember{
		CustomerId: custA.Id, UserId: ownerA.Id, Role: model.CustomerRoleOwner, Status: model.MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)
	require.NoError(t, model.DB.Create(&model.CustomerMember{
		CustomerId: custB.Id, UserId: ownerB.Id, Role: model.CustomerRoleOwner, Status: model.MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)

	scope, err := ResolveSelfLogAccessScope(ownerA.Id, 0, 0)
	require.NoError(t, err)
	require.Equal(t, custA.Id, scope.CustomerId)
	require.False(t, scope.Empty)

	// Forged B customer id must not expand visibility
	scope, err = ResolveSelfLogAccessScope(ownerA.Id, custB.Id, 0)
	require.NoError(t, err)
	require.True(t, scope.Empty)
}

func TestResolveSelfLogAccessScopeMemberOwnOnly(t *testing.T) {
	setupLogAccessDB(t)
	now := time.Now().Unix()
	owner := createLogAccessUser(t, "la-owner")
	member := createLogAccessUser(t, "la-member")
	cust := &model.Customer{Name: "CM", Slug: "cm-" + owner.Username, Status: model.CustomerStatusEnabled, OwnerUserId: owner.Id, UpstreamMode: model.UpstreamModeShared, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, model.DB.Create(cust).Error)
	require.NoError(t, model.DB.Model(owner).Update("customer_id", cust.Id).Error)
	require.NoError(t, model.DB.Model(member).Update("customer_id", cust.Id).Error)
	require.NoError(t, model.DB.Create(&model.CustomerMember{
		CustomerId: cust.Id, UserId: owner.Id, Role: model.CustomerRoleOwner, Status: model.MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)
	require.NoError(t, model.DB.Create(&model.CustomerMember{
		CustomerId: cust.Id, UserId: member.Id, Role: model.CustomerRoleMember, Status: model.MemberStatusEnabled, CreatedAt: now, UpdatedAt: now,
	}).Error)

	scope, err := ResolveSelfLogAccessScope(member.Id, 0, 0)
	require.NoError(t, err)
	require.Equal(t, member.Id, scope.UserId)
	require.Equal(t, 0, scope.CustomerId)
}
