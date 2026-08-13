package model

import (
	"gorm.io/gorm"
)

// WorkspaceMember links a user to a workspace with a role.
type WorkspaceMember struct {
	Id          int    `json:"id"`
	WorkspaceId int    `json:"workspace_id" gorm:"not null;uniqueIndex:uk_workspace_member;index"`
	UserId      int    `json:"user_id" gorm:"not null;uniqueIndex:uk_workspace_member;index"`
	Role        string `json:"role" gorm:"type:varchar(32);not null"`
	Status      int    `json:"status" gorm:"default:1"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (WorkspaceMember) TableName() string {
	return "workspace_members"
}

// IsWorkspaceAdminRole reports whether the workspace role can administer the workspace.
func IsWorkspaceAdminRole(role string) bool {
	return role == WorkspaceRoleAdmin
}

// IsValidWorkspaceRole reports whether role is a known workspace role.
func IsValidWorkspaceRole(role string) bool {
	return role == WorkspaceRoleAdmin || role == WorkspaceRoleMember
}

// GetWorkspaceMember returns the active membership row for user in workspace.
func GetWorkspaceMember(workspaceId, userId int) (*WorkspaceMember, error) {
	if workspaceId <= 0 || userId <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var member WorkspaceMember
	err := DB.Where("workspace_id = ? AND user_id = ? AND status = ?", workspaceId, userId, MemberStatusEnabled).
		First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}
