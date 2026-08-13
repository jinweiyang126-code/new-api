package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type addWorkspaceMemberRequest struct {
	UserId int    `json:"user_id"`
	Role   string `json:"role"`
}

// GetCustomerMembers lists customer members.
func GetCustomerMembers(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	members, err := model.ListCustomerMembers(customerId)
	if err != nil {
		writeMemberErr(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

// DeleteCustomerMember removes a user from the customer (admin+).
func DeleteCustomerMember(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	targetUserId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RemoveCustomerMember(customerId, targetUserId); err != nil {
		writeMemberErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("remove customer member customer=%d user=%d", customerId, targetUserId),
		c.ClientIP(),
		"customer.member.remove",
		map[string]interface{}{"customer_id": customerId, "user_id": targetUserId},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, nil)
}

// GetWorkspaceMembers lists workspace members.
func GetWorkspaceMembers(c *gin.Context) {
	workspaceId := common.GetContextKeyInt(c, constant.ContextKeyWorkspaceId)
	if workspaceId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		workspaceId = id
	}
	members, err := model.ListWorkspaceMembers(workspaceId)
	if err != nil {
		writeMemberErr(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

// AddWorkspaceMember adds a customer member into a workspace (workspace admin+).
func AddWorkspaceMember(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req addWorkspaceMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}
	role := req.Role
	if role == "" {
		role = model.WorkspaceRoleMember
	}
	member, err := model.AddWorkspaceMember(workspaceId, req.UserId, role)
	if err != nil {
		writeMemberErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("add workspace member workspace=%d user=%d role=%s", workspaceId, req.UserId, role),
		c.ClientIP(),
		"workspace.member.add",
		map[string]interface{}{"workspace_id": workspaceId, "user_id": req.UserId, "role": role},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, member)
}

// DeleteWorkspaceMember removes a user from a workspace (workspace admin+).
func DeleteWorkspaceMember(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	targetUserId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RemoveWorkspaceMember(workspaceId, targetUserId); err != nil {
		writeMemberErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("remove workspace member workspace=%d user=%d", workspaceId, targetUserId),
		c.ClientIP(),
		"workspace.member.remove",
		map[string]interface{}{"workspace_id": workspaceId, "user_id": targetUserId},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, nil)
}

func writeMemberErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrMemberNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "member not found"})
	case errors.Is(err, model.ErrCannotRemoveLastOwner):
		common.ApiErrorMsg(c, "cannot remove the last owner")
	case errors.Is(err, model.ErrNotCustomerMember):
		common.ApiErrorMsg(c, "user is not a member of this customer")
	case errors.Is(err, model.ErrWorkspaceMemberExists):
		common.ApiErrorMsg(c, "user is already a workspace member")
	case errors.Is(err, model.ErrInvalidMemberRole):
		common.ApiErrorMsg(c, "invalid member role")
	case errors.Is(err, model.ErrWorkspaceNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
	case errors.Is(err, model.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	default:
		common.ApiError(c, err)
	}
}
