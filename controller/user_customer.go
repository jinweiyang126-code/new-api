/*
Copyright (C) 2023-2026 QuantumNous
*/
package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type setCurrentWorkspaceRequest struct {
	WorkspaceId int `json:"workspace_id"`
}

type setCurrentCustomerRequest struct {
	CustomerId int `json:"customer_id"`
}

// GetSelfCustomer returns the caller's customer context for dashboard gating (T11/T12).
// P3: also returns `customers` — all memberships for multi-customer switching.
func GetSelfCustomer(c *gin.Context) {
	userId := c.GetInt("id")
	systemRole := c.GetInt("role")

	memberships, err := model.ListUserCustomerMemberships(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	role, customerId, err := service.GetUserCustomerRole(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// If current pointer is empty but memberships exist, auto-select the first.
	if customerId <= 0 && len(memberships) > 0 {
		customerId = memberships[0].CustomerId
		_ = model.SetUserCurrentCustomer(userId, customerId)
		role, customerId, err = service.GetUserCustomerRole(userId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	empty := gin.H{
		"customer":             nil,
		"role":                 "",
		"workspaces":           []*model.Workspace{},
		"is_admin":             false,
		"current_workspace_id": 0,
		"customers":            memberships,
	}

	if customerId <= 0 {
		common.ApiSuccess(c, empty)
		return
	}

	customer, err := model.GetCustomerById(customerId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
		return
	}
	workspaces, err := model.GetWorkspacesByCustomerId(customerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	isAdmin := model.IsCustomerAdminRole(role) || service.IsRootUser(systemRole)
	if !isAdmin {
		filtered := make([]*model.Workspace, 0, len(workspaces))
		for _, ws := range workspaces {
			if _, err := model.GetWorkspaceMember(ws.Id, userId); err == nil {
				filtered = append(filtered, ws)
			}
		}
		workspaces = filtered
	}

	currentWorkspaceId := 0
	if user, err := model.GetUserById(userId, false); err == nil && user != nil {
		currentWorkspaceId = resolveCurrentWorkspaceID(user.CurrentWorkspaceId, workspaces)
	}

	common.ApiSuccess(c, gin.H{
		"customer":             customer,
		"role":                 role,
		"workspaces":           workspaces,
		"is_admin":             isAdmin,
		"current_workspace_id": currentWorkspaceId,
		"customers":            memberships,
	})
}

// SetCurrentCustomer switches the caller's current customer context (P3 multi-customer).
func SetCurrentCustomer(c *gin.Context) {
	userId := c.GetInt("id")
	var req setCurrentCustomerRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetUserCurrentCustomer(userId, req.CustomerId); err != nil {
		if errors.Is(err, model.ErrCustomerForbiddenMembership) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "not a member of this customer"})
			return
		}
		common.ApiError(c, err)
		return
	}
	_ = model.UpdateUserCurrentWorkspaceId(userId, 0)
	common.ApiSuccess(c, gin.H{"customer_id": req.CustomerId, "current_workspace_id": 0})
}

// SetCurrentWorkspace updates the caller's UX current workspace (T12).
// workspace_id 0 clears to personal. Billing still follows each token's workspace_id.
func SetCurrentWorkspace(c *gin.Context) {
	userId := c.GetInt("id")
	var req setCurrentWorkspaceRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	workspaceId := req.WorkspaceId
	if workspaceId < 0 {
		workspaceId = 0
	}

	if workspaceId > 0 {
		_, err := model.AssertCanCreateWorkspaceToken(userId, workspaceId)
		if err != nil {
			if errors.Is(err, model.ErrNotWorkspaceTokenMember) ||
				errors.Is(err, model.ErrWorkspaceNotFound) ||
				errors.Is(err, model.ErrWorkspaceDisabled) ||
				errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
			common.ApiError(c, err)
			return
		}
	}

	if err := model.UpdateUserCurrentWorkspaceId(userId, workspaceId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"current_workspace_id": workspaceId})
}

func resolveCurrentWorkspaceID(stored int, workspaces []*model.Workspace) int {
	if stored <= 0 {
		return 0
	}
	for _, ws := range workspaces {
		if ws != nil && ws.Id == stored && ws.Status == model.CustomerStatusEnabled {
			return stored
		}
	}
	return 0
}
