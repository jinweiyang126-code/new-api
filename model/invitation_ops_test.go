package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousRedis := common.RedisEnabled
	previousType := common.MainDatabaseType()
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&User{}, &Customer{}, &Workspace{}, &CustomerMember{}, &WorkspaceMember{}, &CustomerInvitation{},
	))
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func createInviteTestUser(t *testing.T, db *gorm.DB, name string) *User {
	t.Helper()
	u := &User{
		Username: name, Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name + "-aff",
	}
	require.NoError(t, db.Create(u).Error)
	return u
}

func TestAcceptInvitationJoinsDefaultWorkspace(t *testing.T) {
	db := setupInvitationTestDB(t)
	owner := createInviteTestUser(t, db, "inv-owner")
	invitee := createInviteTestUser(t, db, "inv-invitee")
	customer := &Customer{Name: "Invite Co"}
	defaultWS, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	inv, err := CreateInvitation(CreateInvitationInput{
		CustomerId: customer.Id,
		InvitedBy:  owner.Id,
		Role:       CustomerRoleMember,
	})
	require.NoError(t, err)
	require.Equal(t, InvitationStatusPending, inv.Status)
	require.NotEmpty(t, inv.Token)

	accepted, err := AcceptInvitation(inv.Token, invitee.Id)
	require.NoError(t, err)
	require.Equal(t, InvitationStatusAccepted, accepted.Status)

	var user User
	require.NoError(t, db.First(&user, invitee.Id).Error)
	require.Equal(t, customer.Id, user.CustomerId)

	cm, err := GetCustomerMember(customer.Id, invitee.Id)
	require.NoError(t, err)
	require.Equal(t, CustomerRoleMember, cm.Role)

	wm, err := GetWorkspaceMember(defaultWS.Id, invitee.Id)
	require.NoError(t, err)
	require.Equal(t, WorkspaceRoleMember, wm.Role)
}

func TestAcceptInvitationFailsWhenUserAlreadyHasCustomer(t *testing.T) {
	db := setupInvitationTestDB(t)
	ownerA := createInviteTestUser(t, db, "own-a")
	ownerB := createInviteTestUser(t, db, "own-b")
	customerA := &Customer{Name: "A"}
	customerB := &Customer{Name: "B"}
	_, err := CreateCustomerWithOwner(customerA, ownerA.Id)
	require.NoError(t, err)
	_, err = CreateCustomerWithOwner(customerB, ownerB.Id)
	require.NoError(t, err)

	inv, err := CreateInvitation(CreateInvitationInput{
		CustomerId: customerA.Id, InvitedBy: ownerA.Id,
	})
	require.NoError(t, err)

	_, err = AcceptInvitation(inv.Token, ownerB.Id)
	require.ErrorIs(t, err, ErrUserAlreadyHasCustomer)
}

func TestAcceptInvitationRejectsExpiredAndRevoked(t *testing.T) {
	db := setupInvitationTestDB(t)
	owner := createInviteTestUser(t, db, "exp-owner")
	invitee1 := createInviteTestUser(t, db, "exp-user1")
	invitee2 := createInviteTestUser(t, db, "exp-user2")
	customer := &Customer{Name: "Exp Co"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	expired, err := CreateInvitation(CreateInvitationInput{
		CustomerId: customer.Id, InvitedBy: owner.Id,
		ExpiresAt: common.GetTimestamp() - 10,
	})
	require.NoError(t, err)
	_, err = AcceptInvitation(expired.Token, invitee1.Id)
	require.ErrorIs(t, err, ErrInvitationExpired)

	pending, err := CreateInvitation(CreateInvitationInput{
		CustomerId: customer.Id, InvitedBy: owner.Id,
	})
	require.NoError(t, err)
	_, err = RevokeInvitation(pending.Id)
	require.NoError(t, err)
	_, err = AcceptInvitation(pending.Token, invitee2.Id)
	require.ErrorIs(t, err, ErrInvitationRevoked)
}

func TestAcceptInvitationUsesSpecifiedWorkspace(t *testing.T) {
	db := setupInvitationTestDB(t)
	owner := createInviteTestUser(t, db, "ws-inv-owner")
	invitee := createInviteTestUser(t, db, "ws-inv-user")
	customer := &Customer{Name: "WS Invite"}
	_, err := CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)
	extra, err := CreateWorkspace(customer.Id, "Eng", "eng", owner.Id)
	require.NoError(t, err)

	wsID := extra.Id
	inv, err := CreateInvitation(CreateInvitationInput{
		CustomerId:    customer.Id,
		WorkspaceId:   &wsID,
		InvitedBy:     owner.Id,
		WorkspaceRole: WorkspaceRoleAdmin,
	})
	require.NoError(t, err)

	_, err = AcceptInvitation(inv.Token, invitee.Id)
	require.NoError(t, err)

	wm, err := GetWorkspaceMember(extra.Id, invitee.Id)
	require.NoError(t, err)
	require.Equal(t, WorkspaceRoleAdmin, wm.Role)
}
