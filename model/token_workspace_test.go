package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTokenWorkspaceTestDB(t *testing.T) *gorm.DB {
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

func createTokenWSUser(t *testing.T, db *gorm.DB, name string) *User {
	t.Helper()
	u := &User{
		Username: name, Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name + "-aff",
	}
	require.NoError(t, db.Create(u).Error)
	return u
}

func TestPersonalTokenCreateUnchanged(t *testing.T) {
	_ = setupTokenWorkspaceTestDB(t)
	user := createTokenWSUser(t, DB, "personal")
	customerId, err := AssertCanCreateWorkspaceToken(user.Id, 0)
	require.NoError(t, err)
	require.Equal(t, 0, customerId)

	tok := &Token{
		UserId: user.Id, Key: "sk-personal-1", Name: "p", Status: common.TokenStatusEnabled,
		CustomerId: 0, WorkspaceId: 0,
	}
	require.NoError(t, tok.Insert())
	require.Equal(t, 0, tok.CustomerId)
	require.Equal(t, 0, tok.WorkspaceId)
}

func TestNonMemberCannotCreateWorkspaceToken(t *testing.T) {
	db := setupTokenWorkspaceTestDB(t)
	owner := createTokenWSUser(t, db, "tok-owner")
	outsider := createTokenWSUser(t, db, "tok-out")
	customer := &Customer{Name: "Tok Co"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	_, err = AssertCanCreateWorkspaceToken(outsider.Id, ws.Id)
	require.ErrorIs(t, err, ErrNotWorkspaceTokenMember)
}

func TestMemberCanCreateWorkspaceToken(t *testing.T) {
	db := setupTokenWorkspaceTestDB(t)
	owner := createTokenWSUser(t, db, "tok-owner2")
	member := createTokenWSUser(t, db, "tok-member")
	customer := &Customer{Name: "Tok Co2"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	require.NoError(t, db.Create(&CustomerMember{
		CustomerId: customer.Id, UserId: member.Id, Role: CustomerRoleMember, Status: MemberStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&WorkspaceMember{
		WorkspaceId: ws.Id, UserId: member.Id, Role: WorkspaceRoleMember, Status: MemberStatusEnabled,
	}).Error)

	customerId, err := AssertCanCreateWorkspaceToken(member.Id, ws.Id)
	require.NoError(t, err)
	require.Equal(t, customer.Id, customerId)
}

func TestTokenListMemberSeesOwnAdminSeesAllInScope(t *testing.T) {
	db := setupTokenWorkspaceTestDB(t)
	owner := createTokenWSUser(t, db, "list-owner")
	member := createTokenWSUser(t, db, "list-member")
	customer := &Customer{Name: "List Co"}
	ws, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	require.NoError(t, db.Create(&CustomerMember{
		CustomerId: customer.Id, UserId: member.Id, Role: CustomerRoleMember, Status: MemberStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&WorkspaceMember{
		WorkspaceId: ws.Id, UserId: member.Id, Role: WorkspaceRoleMember, Status: MemberStatusEnabled,
	}).Error)

	ownerTok := &Token{
		UserId: owner.Id, Key: "sk-owner-ws", Name: "owner-ws", Status: common.TokenStatusEnabled,
		CustomerId: customer.Id, WorkspaceId: ws.Id,
	}
	memberTok := &Token{
		UserId: member.Id, Key: "sk-member-ws", Name: "member-ws", Status: common.TokenStatusEnabled,
		CustomerId: customer.Id, WorkspaceId: ws.Id,
	}
	memberPersonal := &Token{
		UserId: member.Id, Key: "sk-member-p", Name: "member-p", Status: common.TokenStatusEnabled,
	}
	require.NoError(t, db.Create(ownerTok).Error)
	require.NoError(t, db.Create(memberTok).Error)
	require.NoError(t, db.Create(memberPersonal).Error)

	memberList, err := GetUserTokensPaged(member.Id, 0, 50, 0)
	require.NoError(t, err)
	require.Len(t, memberList, 2) // own workspace + personal only

	ownerList, err := GetUserTokensPaged(owner.Id, 0, 50, 0)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(ownerList), 2) // own + member's workspace token via customer admin
	ids := map[int]bool{}
	for _, tok := range ownerList {
		ids[tok.Id] = true
	}
	require.True(t, ids[ownerTok.Id])
	require.True(t, ids[memberTok.Id])
	require.False(t, ids[memberPersonal.Id]) // personal of other user not visible
}

func TestDisabledWorkspaceRejectsTokenCreate(t *testing.T) {
	db := setupTokenWorkspaceTestDB(t)
	owner := createTokenWSUser(t, db, "dis-owner")
	customer := &Customer{Name: "Dis Co"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	extra, err := CreateWorkspace(customer.Id, "Tmp", "tmp", owner.Id)
	require.NoError(t, err)
	disabled := CustomerStatusDisabled
	_, err = UpdateWorkspaceFields(extra.Id, nil, &disabled)
	require.NoError(t, err)

	_, err = AssertCanCreateWorkspaceToken(owner.Id, extra.Id)
	require.ErrorIs(t, err, ErrWorkspaceDisabled)
}
