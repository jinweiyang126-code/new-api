package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type customerAuthzFixture struct {
	customerID  int
	workspaceID int
	rootID      int
	ownerID     int
	adminID     int
	wsAdminID   int
	memberID    int
	outsiderID  int
}

func setupCustomerAuthzTestDB(t *testing.T) *customerAuthzFixture {
	t.Helper()
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Customer{},
		&model.Workspace{},
		&model.CustomerMember{},
		&model.WorkspaceMember{},
		&model.OrganizationWallet{},
	))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	createUser := func(username string, role int, customerId int) int {
		u := &model.User{
			Username:    username,
			Password:    "password123",
			Role:        role,
			Status:      common.UserStatusEnabled,
			Group:       "default",
			AuthVersion: 1,
			CustomerId:  customerId,
			AffCode:     username + "-aff",
		}
		require.NoError(t, db.Create(u).Error)
		return u.Id
	}

	rootID := createUser("root", common.RoleRootUser, 0)
	ownerID := createUser("owner", common.RoleCommonUser, 0)
	adminID := createUser("admin", common.RoleCommonUser, 0)
	wsAdminID := createUser("ws_admin", common.RoleCommonUser, 0)
	memberID := createUser("member", common.RoleCommonUser, 0)
	outsiderID := createUser("outsider", common.RoleCommonUser, 0)

	customer := &model.Customer{
		Name:                "Acme",
		Slug:                "acme",
		Status:              model.CustomerStatusEnabled,
		OwnerUserId:         ownerID,
		UpstreamMode:        model.UpstreamModeShared,
		AllowGlobalFallback: true,
	}
	require.NoError(t, db.Create(customer).Error)

	require.NoError(t, db.Model(&model.User{}).Where("id IN ?", []int{ownerID, adminID, wsAdminID, memberID}).
		Update("customer_id", customer.Id).Error)

	ws := &model.Workspace{
		CustomerId: customer.Id,
		Name:       "default",
		Slug:       model.WorkspaceSlugDefault,
		Status:     model.CustomerStatusEnabled,
		IsDefault:  true,
	}
	require.NoError(t, db.Create(ws).Error)

	members := []model.CustomerMember{
		{CustomerId: customer.Id, UserId: ownerID, Role: model.CustomerRoleOwner, Status: model.MemberStatusEnabled},
		{CustomerId: customer.Id, UserId: adminID, Role: model.CustomerRoleAdmin, Status: model.MemberStatusEnabled},
		{CustomerId: customer.Id, UserId: wsAdminID, Role: model.CustomerRoleMember, Status: model.MemberStatusEnabled},
		{CustomerId: customer.Id, UserId: memberID, Role: model.CustomerRoleMember, Status: model.MemberStatusEnabled},
	}
	for i := range members {
		require.NoError(t, db.Create(&members[i]).Error)
	}

	wsMembers := []model.WorkspaceMember{
		{WorkspaceId: ws.Id, UserId: ownerID, Role: model.WorkspaceRoleAdmin, Status: model.MemberStatusEnabled},
		{WorkspaceId: ws.Id, UserId: adminID, Role: model.WorkspaceRoleAdmin, Status: model.MemberStatusEnabled},
		{WorkspaceId: ws.Id, UserId: wsAdminID, Role: model.WorkspaceRoleAdmin, Status: model.MemberStatusEnabled},
		{WorkspaceId: ws.Id, UserId: memberID, Role: model.WorkspaceRoleMember, Status: model.MemberStatusEnabled},
	}
	for i := range wsMembers {
		require.NoError(t, db.Create(&wsMembers[i]).Error)
	}

	return &customerAuthzFixture{
		customerID:  customer.Id,
		workspaceID: ws.Id,
		rootID:      rootID,
		ownerID:     ownerID,
		adminID:     adminID,
		wsAdminID:   wsAdminID,
		memberID:    memberID,
		outsiderID:  outsiderID,
	}
}

func TestGetUserCustomerRole(t *testing.T) {
	fx := setupCustomerAuthzTestDB(t)

	role, customerId, err := GetUserCustomerRole(fx.ownerID)
	require.NoError(t, err)
	require.Equal(t, model.CustomerRoleOwner, role)
	require.Equal(t, fx.customerID, customerId)

	role, customerId, err = GetUserCustomerRole(fx.outsiderID)
	require.NoError(t, err)
	require.Equal(t, "", role)
	require.Equal(t, 0, customerId)
}

func TestRequireCustomerMemberAndAdmin(t *testing.T) {
	fx := setupCustomerAuthzTestDB(t)

	_, err := RequireCustomerMember(fx.outsiderID, common.RoleCommonUser, fx.customerID)
	require.ErrorIs(t, err, ErrCustomerForbidden)

	role, err := RequireCustomerMember(fx.memberID, common.RoleCommonUser, fx.customerID)
	require.NoError(t, err)
	require.Equal(t, model.CustomerRoleMember, role)

	_, err = RequireCustomerMember(fx.rootID, common.RoleRootUser, fx.customerID)
	require.NoError(t, err)

	_, err = RequireCustomerAdmin(fx.memberID, common.RoleCommonUser, fx.customerID)
	require.ErrorIs(t, err, ErrCustomerForbidden)

	role, err = RequireCustomerAdmin(fx.adminID, common.RoleCommonUser, fx.customerID)
	require.NoError(t, err)
	require.Equal(t, model.CustomerRoleAdmin, role)

	_, err = RequireCustomerAdmin(fx.rootID, common.RoleRootUser, fx.customerID)
	require.NoError(t, err)
}

func TestRequireWorkspaceMemberAndAdmin(t *testing.T) {
	fx := setupCustomerAuthzTestDB(t)

	_, _, err := RequireWorkspaceMember(fx.outsiderID, common.RoleCommonUser, fx.workspaceID)
	require.ErrorIs(t, err, ErrCustomerForbidden)

	role, customerId, err := RequireWorkspaceMember(fx.memberID, common.RoleCommonUser, fx.workspaceID)
	require.NoError(t, err)
	require.Equal(t, model.WorkspaceRoleMember, role)
	require.Equal(t, fx.customerID, customerId)

	_, _, err = RequireWorkspaceAdmin(fx.memberID, common.RoleCommonUser, fx.workspaceID)
	require.ErrorIs(t, err, ErrCustomerForbidden)

	role, _, err = RequireWorkspaceAdmin(fx.wsAdminID, common.RoleCommonUser, fx.workspaceID)
	require.NoError(t, err)
	require.Equal(t, model.WorkspaceRoleAdmin, role)

	// Customer admin without explicit workspace_member still gets workspace admin via elevation.
	// In fixture they also have workspace membership; create a customer-admin-only user.
	onlyAdmin := &model.User{
		Username: "cust_admin_only", Password: "password123", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, CustomerId: fx.customerID,
		AffCode: "cust-admin-only-aff",
	}
	require.NoError(t, model.DB.Create(onlyAdmin).Error)
	require.NoError(t, model.DB.Create(&model.CustomerMember{
		CustomerId: fx.customerID, UserId: onlyAdmin.Id, Role: model.CustomerRoleAdmin, Status: model.MemberStatusEnabled,
	}).Error)
	role, _, err = RequireWorkspaceAdmin(onlyAdmin.Id, common.RoleCommonUser, fx.workspaceID)
	require.NoError(t, err)
	require.Equal(t, model.WorkspaceRoleAdmin, role)
}

func TestCustomerCapabilityMatrix(t *testing.T) {
	fx := setupCustomerAuthzTestDB(t)
	cid, wid := fx.customerID, fx.workspaceID

	type actor struct {
		name       string
		userID     int
		systemRole int
	}
	actors := []actor{
		{"root", fx.rootID, common.RoleRootUser},
		{"owner", fx.ownerID, common.RoleCommonUser},
		{"customer_admin", fx.adminID, common.RoleCommonUser},
		{"workspace_admin", fx.wsAdminID, common.RoleCommonUser},
		{"member", fx.memberID, common.RoleCommonUser},
		{"outsider", fx.outsiderID, common.RoleCommonUser},
	}

	// Expected allow matrix: root, owner, customer_admin, workspace_admin, member, outsider
	cases := []struct {
		cap      CustomerCapability
		expected [6]bool
	}{
		{CapCreateCustomer, [6]bool{true, false, false, false, false, false}},
		{CapTopupCustomer, [6]bool{true, false, false, false, false, false}},
		{CapManageUpstream, [6]bool{true, false, false, false, false, false}},
		{CapManageGlobalChannels, [6]bool{true, false, false, false, false, false}},
		{CapCreateWorkspace, [6]bool{true, true, true, false, false, false}},
		{CapInviteMember, [6]bool{true, true, true, false, false, false}},
		{CapAllocateQuota, [6]bool{true, true, true, false, false, false}},
		{CapManageByokCredential, [6]bool{true, true, true, false, false, false}},
		{CapViewCustomerLogs, [6]bool{true, true, true, false, false, false}},
		{CapManageWorkspaceMembers, [6]bool{true, true, true, true, false, false}},
		{CapViewWorkspaceLogs, [6]bool{true, true, true, true, false, false}},
		{CapCreateWorkspaceToken, [6]bool{true, true, true, true, true, false}},
		{CapViewOwnLogs, [6]bool{true, true, true, true, true, false}},
	}

	for _, tc := range cases {
		for i, a := range actors {
			got := CanCustomerCapability(a.userID, a.systemRole, cid, wid, tc.cap)
			require.Equalf(t, tc.expected[i], got, "cap=%s actor=%s", tc.cap, a.name)
		}
	}
}
