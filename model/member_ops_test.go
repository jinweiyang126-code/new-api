package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupMemberOpsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousRedis := common.RedisEnabled
	previousType := common.MainDatabaseType()
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&User{}, &Customer{}, &Workspace{}, &CustomerMember{}, &WorkspaceMember{}, &Token{},
	))
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func createMemberTestUser(t *testing.T, db *gorm.DB, name string) *User {
	t.Helper()
	u := &User{
		Username: name, Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name + "-aff",
	}
	require.NoError(t, db.Create(u).Error)
	return u
}

func TestRemoveCustomerMemberDisablesTokensAndClearsCustomerId(t *testing.T) {
	db := setupMemberOpsTestDB(t)
	owner := createMemberTestUser(t, db, "owner-rm")
	member := createMemberTestUser(t, db, "member-rm")

	customer := &Customer{Name: "Member Co"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	// Second owner so we can remove the first member without last-owner issues;
	// add member as customer member + workspace member.
	require.NoError(t, db.Create(&CustomerMember{
		CustomerId: customer.Id, UserId: member.Id, Role: CustomerRoleMember, Status: MemberStatusEnabled,
	}).Error)
	require.NoError(t, db.Model(member).Update("customer_id", customer.Id).Error)
	require.NoError(t, db.Create(&WorkspaceMember{
		WorkspaceId: ws.Id, UserId: member.Id, Role: WorkspaceRoleMember, Status: MemberStatusEnabled,
	}).Error)

	customerToken := &Token{
		UserId: member.Id, Key: "sk-customer-token-1", Status: common.TokenStatusEnabled,
		Name: "ws", CustomerId: customer.Id, WorkspaceId: ws.Id,
	}
	personalToken := &Token{
		UserId: member.Id, Key: "sk-personal-token-1", Status: common.TokenStatusEnabled,
		Name: "personal", CustomerId: 0, WorkspaceId: 0,
	}
	require.NoError(t, db.Create(customerToken).Error)
	require.NoError(t, db.Create(personalToken).Error)

	require.NoError(t, RemoveCustomerMember(customer.Id, member.Id))

	var user User
	require.NoError(t, db.First(&user, member.Id).Error)
	require.Equal(t, 0, user.CustomerId)

	var ct Token
	require.NoError(t, db.First(&ct, customerToken.Id).Error)
	require.Equal(t, common.TokenStatusDisabled, ct.Status)

	var pt Token
	require.NoError(t, db.First(&pt, personalToken.Id).Error)
	require.Equal(t, common.TokenStatusEnabled, pt.Status)

	_, err = GetCustomerMember(customer.Id, member.Id)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	_, err = GetWorkspaceMember(ws.Id, member.Id)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestCannotRemoveLastOwner(t *testing.T) {
	db := setupMemberOpsTestDB(t)
	owner := createMemberTestUser(t, db, "last-owner")
	customer := &Customer{Name: "Solo"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	err = RemoveCustomerMember(customer.Id, owner.Id)
	require.ErrorIs(t, err, ErrCannotRemoveLastOwner)
}

func TestAddWorkspaceMemberRequiresCustomerMembership(t *testing.T) {
	db := setupMemberOpsTestDB(t)
	owner := createMemberTestUser(t, db, "ws-owner")
	outsider := createMemberTestUser(t, db, "outsider")
	customer := &Customer{Name: "WS Gate"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	_, err = AddWorkspaceMember(ws.Id, outsider.Id, WorkspaceRoleMember)
	require.ErrorIs(t, err, ErrNotCustomerMember)
}

func TestAddWorkspaceMemberSucceedsForCustomerMember(t *testing.T) {
	db := setupMemberOpsTestDB(t)
	owner := createMemberTestUser(t, db, "ws-owner2")
	member := createMemberTestUser(t, db, "ws-member2")
	customer := &Customer{Name: "WS OK"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	require.NoError(t, db.Create(&CustomerMember{
		CustomerId: customer.Id, UserId: member.Id, Role: CustomerRoleMember, Status: MemberStatusEnabled,
	}).Error)
	require.NoError(t, db.Model(member).Update("customer_id", customer.Id).Error)

	extra, err := CreateWorkspace(customer.Id, "Eng", "eng", owner.Id)
	require.NoError(t, err)

	m, err := AddWorkspaceMember(extra.Id, member.Id, WorkspaceRoleMember)
	require.NoError(t, err)
	require.Equal(t, member.Id, m.UserId)
	require.Equal(t, WorkspaceRoleMember, m.Role)
}
