package service

import (
	"errors"

	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

// ResolveSelfLogAccessScope builds the forced log visibility for /api/log/self*.
// requestedCustomerId / requestedWorkspaceId may only narrow the allowed window;
// foreign ids never expand visibility (anti-forgery).
func ResolveSelfLogAccessScope(userId, requestedCustomerId, requestedWorkspaceId int) (model.LogAccessScope, error) {
	if userId <= 0 {
		return model.LogAccessScope{Empty: true}, nil
	}

	role, customerId, err := model.GetUserCustomerRole(userId)
	if err != nil {
		return model.LogAccessScope{}, err
	}

	// Customer owner/admin: entire customer (optional workspace narrow).
	if customerId > 0 && model.IsCustomerAdminRole(role) {
		scope := model.LogAccessScope{CustomerId: customerId}
		if requestedCustomerId > 0 && requestedCustomerId != customerId {
			// Forged other-tenant id → empty result, not an expansion.
			return model.LogAccessScope{Empty: true}, nil
		}
		if requestedWorkspaceId > 0 {
			ws, wsErr := model.GetWorkspaceById(requestedWorkspaceId)
			if wsErr != nil {
				if errors.Is(wsErr, gorm.ErrRecordNotFound) {
					return model.LogAccessScope{Empty: true}, nil
				}
				return model.LogAccessScope{}, wsErr
			}
			if ws.CustomerId != customerId {
				return model.LogAccessScope{Empty: true}, nil
			}
			scope.WorkspaceId = requestedWorkspaceId
		}
		return scope, nil
	}

	adminWorkspaceIds, err := model.ListAdminWorkspaceIdsByUser(userId)
	if err != nil {
		return model.LogAccessScope{}, err
	}

	if requestedWorkspaceId > 0 {
		// Workspace admin of requested → that workspace; else member → own rows only if member.
		if containsInt(adminWorkspaceIds, requestedWorkspaceId) {
			return model.LogAccessScope{WorkspaceId: requestedWorkspaceId}, nil
		}
		if _, mErr := model.GetWorkspaceMember(requestedWorkspaceId, userId); mErr == nil {
			return model.LogAccessScope{UserId: userId, WorkspaceId: requestedWorkspaceId}, nil
		}
		return model.LogAccessScope{Empty: true}, nil
	}

	if len(adminWorkspaceIds) > 0 {
		// Workspace admin without filter: all logs in administered workspaces.
		return model.LogAccessScope{WorkspaceIds: adminWorkspaceIds}, nil
	}

	// Member / personal: own logs only. Ignore forged customer_id.
	if requestedCustomerId > 0 && requestedCustomerId != customerId {
		return model.LogAccessScope{Empty: true}, nil
	}
	return model.LogAccessScope{UserId: userId}, nil
}

func containsInt(ids []int, v int) bool {
	for _, id := range ids {
		if id == v {
			return true
		}
	}
	return false
}
