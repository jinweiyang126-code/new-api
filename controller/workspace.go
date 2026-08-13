package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createWorkspaceRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type updateWorkspaceRequest struct {
	Name   *string `json:"name"`
	Status *int    `json:"status"`
}

type transferQuotaRequest struct {
	Amount int `json:"amount"`
}

// CreateWorkspace creates a workspace under a customer (customer admin+ / root).
func CreateWorkspace(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	var req createWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	creatorId := c.GetInt("id")
	if service.IsRootUser(c.GetInt("role")) {
		// Root may create without becoming a workspace member.
		creatorId = 0
	}
	ws, err := model.CreateWorkspace(customerId, req.Name, req.Slug, creatorId)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("create workspace id=%d customer=%d", ws.Id, customerId),
		c.ClientIP(),
		"workspace.create",
		map[string]interface{}{"workspace_id": ws.Id, "customer_id": customerId, "slug": ws.Slug},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, ws)
}

// GetWorkspace returns workspace detail (workspace member / customer admin / root).
func GetWorkspace(c *gin.Context) {
	workspaceId := common.GetContextKeyInt(c, constant.ContextKeyWorkspaceId)
	if workspaceId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		workspaceId = id
	}
	ws, err := model.GetWorkspaceById(workspaceId)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}
	common.ApiSuccess(c, ws)
}

// UpdateWorkspace updates name/status (workspace admin / customer admin / root).
func UpdateWorkspace(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req updateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Name == nil && req.Status == nil {
		common.ApiErrorMsg(c, "no fields to update")
		return
	}
	ws, err := model.UpdateWorkspaceFields(workspaceId, req.Name, req.Status)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}
	common.ApiSuccess(c, ws)
}

// TransferWorkspaceQuota moves quota from customer pool to workspace (customer admin+ / root).
func TransferWorkspaceQuota(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req transferQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	ws, err := model.GetWorkspaceById(workspaceId)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}
	userId := c.GetInt("id")
	systemRole := c.GetInt("role")
	if _, err := service.RequireCustomerAdmin(userId, systemRole, ws.CustomerId); err != nil {
		if errors.Is(err, service.ErrCustomerForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
			return
		}
		writeWorkspaceErr(c, err)
		return
	}

	customer, workspace, err := model.TransferQuotaToWorkspace(workspaceId, req.Amount)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}

	operatorId := userId
	content := fmt.Sprintf("transfer quota workspace=%d amount=%s customer_balance=%s workspace_balance=%s",
		workspaceId, logger.LogQuota(req.Amount), logger.LogQuota(customer.Quota), logger.LogQuota(workspace.Quota))
	model.RecordOperationAuditLog(operatorId, content, c.ClientIP(), "workspace.transfer_quota",
		map[string]interface{}{
			"workspace_id":     workspaceId,
			"customer_id":      customer.Id,
			"amount":           req.Amount,
			"customer_quota":   customer.Quota,
			"workspace_quota":  workspace.Quota,
		},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)

	common.ApiSuccess(c, gin.H{
		"customer":  customer,
		"workspace": workspace,
	})
}

func writeWorkspaceErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrWorkspaceNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "workspace not found"})
	case errors.Is(err, model.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, model.ErrWorkspaceSlugDuplicated):
		common.ApiErrorMsg(c, "workspace slug already exists in this customer")
	case errors.Is(err, model.ErrWorkspaceDisabled):
		common.ApiErrorMsg(c, "workspace is disabled")
	case errors.Is(err, model.ErrInsufficientCustomerQuota):
		common.ApiErrorMsg(c, "insufficient customer quota")
	case errors.Is(err, model.ErrInvalidTransferQuotaAmount):
		common.ApiErrorMsg(c, "transfer amount must be positive")
	case errors.Is(err, model.ErrCannotDisableDefaultWorkspace):
		common.ApiErrorMsg(c, "cannot disable the default workspace")
	case errors.Is(err, service.ErrCustomerForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
	default:
		common.ApiError(c, err)
	}
}
