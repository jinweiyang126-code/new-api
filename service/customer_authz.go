package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

var (
	// ErrCustomerForbidden is returned when the user lacks customer/workspace privilege.
	ErrCustomerForbidden = errors.New("customer workspace access forbidden")
	// ErrCustomerNotFound is returned when the target customer/workspace does not exist.
	ErrCustomerNotFound = errors.New("customer or workspace not found")
)

// CustomerCapability enumerates M1 permission matrix cells (design §6).
type CustomerCapability string

const (
	CapCreateCustomer         CustomerCapability = "create_customer"
	CapTopupCustomer          CustomerCapability = "topup_customer"
	CapCreateWorkspace        CustomerCapability = "create_workspace"
	CapInviteMember           CustomerCapability = "invite_member"
	CapAllocateQuota          CustomerCapability = "allocate_quota"
	CapManageWorkspaceMembers CustomerCapability = "manage_workspace_members"
	CapCreateWorkspaceToken   CustomerCapability = "create_workspace_token"
	CapManageUpstream         CustomerCapability = "manage_upstream"
	CapManageByokCredential   CustomerCapability = "manage_byok_credential"
	CapViewCustomerLogs       CustomerCapability = "view_customer_logs"
	CapViewWorkspaceLogs      CustomerCapability = "view_workspace_logs"
	CapViewOwnLogs            CustomerCapability = "view_own_logs"
	CapManageGlobalChannels   CustomerCapability = "manage_global_channels"
)

// IsRootUser reports whether the platform system role is root (超管).
func IsRootUser(systemRole int) bool {
	return systemRole >= common.RoleRootUser
}

// RequireCustomerMember ensures the user is an active member of customerId, or root.
// Returns the customer role (empty string for root bypass).
func RequireCustomerMember(userId, systemRole, customerId int) (customerRole string, err error) {
	if customerId <= 0 {
		return "", ErrCustomerNotFound
	}
	if IsRootUser(systemRole) {
		return "", nil
	}
	member, err := model.GetCustomerMember(customerId, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrCustomerForbidden
		}
		return "", err
	}
	if !model.IsValidCustomerRole(member.Role) {
		return "", ErrCustomerForbidden
	}
	return member.Role, nil
}

// RequireCustomerAdmin ensures the user is customer owner/admin, or root.
func RequireCustomerAdmin(userId, systemRole, customerId int) (customerRole string, err error) {
	role, err := RequireCustomerMember(userId, systemRole, customerId)
	if err != nil {
		return "", err
	}
	if IsRootUser(systemRole) {
		return "", nil
	}
	if !model.IsCustomerAdminRole(role) {
		return role, ErrCustomerForbidden
	}
	return role, nil
}

// RequireWorkspaceMember ensures the user can access the workspace (design: customer
// admin of the owning customer, or an active workspace member), or root.
func RequireWorkspaceMember(userId, systemRole, workspaceId int) (workspaceRole string, customerId int, err error) {
	if workspaceId <= 0 {
		return "", 0, ErrCustomerNotFound
	}
	workspace, err := model.GetWorkspaceById(workspaceId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", 0, ErrCustomerNotFound
		}
		return "", 0, err
	}
	if IsRootUser(systemRole) {
		return "", workspace.CustomerId, nil
	}

	customerRole, err := RequireCustomerMember(userId, systemRole, workspace.CustomerId)
	if err != nil {
		return "", 0, err
	}
	if model.IsCustomerAdminRole(customerRole) {
		// Customer owner/admin may operate any workspace under the customer.
		return model.WorkspaceRoleAdmin, workspace.CustomerId, nil
	}

	member, err := model.GetWorkspaceMember(workspaceId, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", 0, ErrCustomerForbidden
		}
		return "", 0, err
	}
	if !model.IsValidWorkspaceRole(member.Role) {
		return "", 0, ErrCustomerForbidden
	}
	return member.Role, workspace.CustomerId, nil
}

// RequireWorkspaceAdmin ensures the user can administer the workspace
// (customer owner/admin or workspace admin), or root.
func RequireWorkspaceAdmin(userId, systemRole, workspaceId int) (workspaceRole string, customerId int, err error) {
	role, customerId, err := RequireWorkspaceMember(userId, systemRole, workspaceId)
	if err != nil {
		return "", 0, err
	}
	if IsRootUser(systemRole) {
		return "", customerId, nil
	}
	if !model.IsWorkspaceAdminRole(role) {
		return role, customerId, ErrCustomerForbidden
	}
	return role, customerId, nil
}

// resolveMembershipRoles loads customer/workspace roles for capability checks.
func resolveMembershipRoles(userId, systemRole, customerId, workspaceId int) (customerRole, workspaceRole string, ok bool) {
	if workspaceId > 0 {
		wsRole, cid, err := RequireWorkspaceMember(userId, systemRole, workspaceId)
		if err != nil {
			return "", "", false
		}
		workspaceRole = wsRole
		if customerId <= 0 {
			customerId = cid
		} else if customerId != cid {
			return "", "", false
		}
	}
	if customerId > 0 {
		role, err := RequireCustomerMember(userId, systemRole, customerId)
		if err != nil {
			return "", "", false
		}
		customerRole = role
	}
	return customerRole, workspaceRole, true
}

// CanCustomerCapability evaluates design §6 matrix for a user against an optional
// customer/workspace scope. workspaceId may be 0 when not applicable.
func CanCustomerCapability(userId, systemRole, customerId, workspaceId int, cap CustomerCapability) bool {
	if IsRootUser(systemRole) {
		return true
	}

	customerRole, workspaceRole, ok := resolveMembershipRoles(userId, systemRole, customerId, workspaceId)
	if !ok {
		return false
	}

	isCustomerAdmin := model.IsCustomerAdminRole(customerRole)
	isCustomerMember := customerRole != ""
	isWorkspaceAdmin := model.IsWorkspaceAdminRole(workspaceRole)
	isWorkspaceMember := workspaceRole != ""

	switch cap {
	case CapCreateCustomer, CapTopupCustomer, CapManageUpstream, CapManageGlobalChannels:
		return false // root only
	case CapCreateWorkspace, CapInviteMember, CapAllocateQuota, CapManageByokCredential, CapViewCustomerLogs:
		return isCustomerAdmin
	case CapManageWorkspaceMembers, CapViewWorkspaceLogs:
		return isCustomerAdmin || isWorkspaceAdmin
	case CapCreateWorkspaceToken:
		return isCustomerAdmin || isWorkspaceMember
	case CapViewOwnLogs:
		return isCustomerMember || isWorkspaceMember
	default:
		return false
	}
}

// GetUserCustomerRole wraps model.GetUserCustomerRole for callers in service layer.
func GetUserCustomerRole(userId int) (role string, customerId int, err error) {
	return model.GetUserCustomerRole(userId)
}
