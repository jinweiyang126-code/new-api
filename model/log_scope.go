package model

import "gorm.io/gorm"

// LogAccessScope is the server-enforced visibility window for log list/stat.
// Callers must build this from membership — never trust client-supplied ids alone.
type LogAccessScope struct {
	// Empty forces zero rows (e.g. forged cross-tenant filter).
	Empty bool
	// UserId > 0 restricts to that user (member / personal mode).
	UserId int
	// CustomerId > 0 restricts to that customer (customer admin).
	CustomerId int
	// WorkspaceId > 0 restricts to one workspace.
	WorkspaceId int
	// WorkspaceIds restricts to any of these workspaces (workspace admin multi-scope).
	WorkspaceIds []int
}

func applyLogAccessScope(tx *gorm.DB, scope LogAccessScope, tablePrefix string) *gorm.DB {
	if scope.Empty {
		return tx.Where("1 = 0")
	}
	col := func(name string) string {
		if tablePrefix == "" {
			return name
		}
		return tablePrefix + name
	}
	if scope.UserId > 0 {
		tx = tx.Where(col("user_id")+" = ?", scope.UserId)
	}
	if scope.CustomerId > 0 {
		tx = tx.Where(col("customer_id")+" = ?", scope.CustomerId)
	}
	if scope.WorkspaceId > 0 {
		tx = tx.Where(col("workspace_id")+" = ?", scope.WorkspaceId)
	} else if len(scope.WorkspaceIds) > 0 {
		tx = tx.Where(col("workspace_id")+" IN ?", scope.WorkspaceIds)
	}
	return tx
}

// ListAdminWorkspaceIdsByUser returns workspace ids where the user is an active workspace admin.
func ListAdminWorkspaceIdsByUser(userId int) ([]int, error) {
	if userId <= 0 {
		return nil, nil
	}
	var ids []int
	err := DB.Model(&WorkspaceMember{}).
		Where("user_id = ? AND status = ? AND role = ?", userId, MemberStatusEnabled, WorkspaceRoleAdmin).
		Pluck("workspace_id", &ids).Error
	return ids, err
}
