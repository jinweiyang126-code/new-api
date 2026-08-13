package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrMemberNotFound          = errors.New("member not found")
	ErrCannotRemoveLastOwner   = errors.New("cannot remove the last owner")
	ErrNotCustomerMember       = errors.New("user is not a member of this customer")
	ErrWorkspaceMemberExists   = errors.New("user is already a workspace member")
	ErrInvalidMemberRole       = errors.New("invalid member role")
)

// CustomerMemberView is a list row with optional username.
type CustomerMemberView struct {
	CustomerMember
	Username string `json:"username"`
}

// WorkspaceMemberView is a list row with optional username.
type WorkspaceMemberView struct {
	WorkspaceMember
	Username string `json:"username"`
}

// ListCustomerMembers returns active members of a customer.
func ListCustomerMembers(customerId int) ([]CustomerMemberView, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	var members []CustomerMember
	if err := DB.Where("customer_id = ? AND status = ?", customerId, MemberStatusEnabled).
		Order("id asc").Find(&members).Error; err != nil {
		return nil, err
	}
	return attachCustomerMemberUsernames(members)
}

func attachCustomerMemberUsernames(members []CustomerMember) ([]CustomerMemberView, error) {
	out := make([]CustomerMemberView, 0, len(members))
	if len(members) == 0 {
		return out, nil
	}
	ids := make([]int, 0, len(members))
	for _, m := range members {
		ids = append(ids, m.UserId)
	}
	nameByID, err := usernamesByIDs(ids)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		out = append(out, CustomerMemberView{CustomerMember: m, Username: nameByID[m.UserId]})
	}
	return out, nil
}

// ListWorkspaceMembers returns active members of a workspace.
func ListWorkspaceMembers(workspaceId int) ([]WorkspaceMemberView, error) {
	if workspaceId <= 0 {
		return nil, ErrWorkspaceNotFound
	}
	var members []WorkspaceMember
	if err := DB.Where("workspace_id = ? AND status = ?", workspaceId, MemberStatusEnabled).
		Order("id asc").Find(&members).Error; err != nil {
		return nil, err
	}
	out := make([]WorkspaceMemberView, 0, len(members))
	if len(members) == 0 {
		return out, nil
	}
	ids := make([]int, 0, len(members))
	for _, m := range members {
		ids = append(ids, m.UserId)
	}
	nameByID, err := usernamesByIDs(ids)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		out = append(out, WorkspaceMemberView{WorkspaceMember: m, Username: nameByID[m.UserId]})
	}
	return out, nil
}

func usernamesByIDs(ids []int) (map[int]string, error) {
	type row struct {
		Id       int
		Username string
	}
	var rows []row
	if err := DB.Model(&User{}).Select("id", "username").Where("id IN ?", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[int]string, len(rows))
	for _, r := range rows {
		out[r.Id] = r.Username
	}
	return out, nil
}

// RemoveCustomerMember removes a user from the customer, clears users.customer_id,
// removes workspace memberships under the customer, and disables customer tokens.
func RemoveCustomerMember(customerId, targetUserId int) error {
	if customerId <= 0 || targetUserId <= 0 {
		return ErrMemberNotFound
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var member CustomerMember
		if err := lockForUpdate(tx).
			Where("customer_id = ? AND user_id = ? AND status = ?", customerId, targetUserId, MemberStatusEnabled).
			First(&member).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrMemberNotFound
			}
			return err
		}

		if member.Role == CustomerRoleOwner {
			var ownerCount int64
			if err := tx.Model(&CustomerMember{}).
				Where("customer_id = ? AND role = ? AND status = ?", customerId, CustomerRoleOwner, MemberStatusEnabled).
				Count(&ownerCount).Error; err != nil {
				return err
			}
			if ownerCount <= 1 {
				return ErrCannotRemoveLastOwner
			}
		}

		if err := tx.Where("customer_id = ? AND user_id = ?", customerId, targetUserId).
			Delete(&CustomerMember{}).Error; err != nil {
			return err
		}

		var workspaceIDs []int
		if err := tx.Model(&Workspace{}).Where("customer_id = ?", customerId).
			Pluck("id", &workspaceIDs).Error; err != nil {
			return err
		}
		if len(workspaceIDs) > 0 {
			if err := tx.Where("workspace_id IN ? AND user_id = ?", workspaceIDs, targetUserId).
				Delete(&WorkspaceMember{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&User{}).
			Where("id = ? AND customer_id = ?", targetUserId, customerId).
			Updates(map[string]interface{}{"customer_id": 0}).Error; err != nil {
			return err
		}

		// Disable all tokens scoped to this customer for the user (personal tokens untouched).
		if err := tx.Model(&Token{}).
			Where("user_id = ? AND customer_id = ?", targetUserId, customerId).
			Updates(map[string]interface{}{
				"status": common.TokenStatusDisabled,
			}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	// Redis may still hold enabled token snapshots; force reload on next TokenAuth.
	if cacheErr := InvalidateUserTokensCache(targetUserId); cacheErr != nil {
		common.SysLog(fmt.Sprintf("InvalidateUserTokensCache after RemoveCustomerMember user=%d: %v", targetUserId, cacheErr))
	}
	return nil
}

// AddWorkspaceMember adds an existing customer member into a workspace.
func AddWorkspaceMember(workspaceId, userId int, role string) (*WorkspaceMember, error) {
	if !IsValidWorkspaceRole(role) {
		return nil, ErrInvalidMemberRole
	}
	var created *WorkspaceMember
	err := DB.Transaction(func(tx *gorm.DB) error {
		var ws Workspace
		if err := tx.Where("id = ?", workspaceId).First(&ws).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWorkspaceNotFound
			}
			return err
		}

		var cm CustomerMember
		if err := tx.Where("customer_id = ? AND user_id = ? AND status = ?",
			ws.CustomerId, userId, MemberStatusEnabled).First(&cm).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotCustomerMember
			}
			return err
		}

		var existing WorkspaceMember
		err := tx.Where("workspace_id = ? AND user_id = ?", workspaceId, userId).First(&existing).Error
		if err == nil {
			if existing.Status == MemberStatusEnabled {
				return ErrWorkspaceMemberExists
			}
			now := common.GetTimestamp()
			existing.Role = role
			existing.Status = MemberStatusEnabled
			existing.UpdatedAt = now
			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
			created = &existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		now := common.GetTimestamp()
		m := &WorkspaceMember{
			WorkspaceId: workspaceId,
			UserId:      userId,
			Role:        role,
			Status:      MemberStatusEnabled,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := tx.Create(m).Error; err != nil {
			return err
		}
		created = m
		return nil
	})
	return created, err
}

// RemoveWorkspaceMember removes a user from a workspace (does not leave the customer).
func RemoveWorkspaceMember(workspaceId, userId int) error {
	if workspaceId <= 0 || userId <= 0 {
		return ErrMemberNotFound
	}
	result := DB.Where("workspace_id = ? AND user_id = ?", workspaceId, userId).
		Delete(&WorkspaceMember{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrMemberNotFound
	}
	return nil
}
