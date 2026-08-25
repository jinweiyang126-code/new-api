package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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
	Name       *string `json:"name"`
	Status     *int    `json:"status"`
	QuotaLimit *int    `json:"quota_limit"`
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
	_ = model.AttachWorkspaceQuotaLimitView(ws)
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
	if req.Name == nil && req.Status == nil && req.QuotaLimit == nil {
		common.ApiErrorMsg(c, "no fields to update")
		return
	}
	ws, err := model.UpdateWorkspaceFields(workspaceId, req.Name, req.Status, req.QuotaLimit)
	if err != nil {
		writeWorkspaceErr(c, err)
		return
	}
	common.ApiSuccess(c, ws)
}

// TransferWorkspaceQuota is deprecated under the limit + allocatable model.
func TransferWorkspaceQuota(c *gin.Context) {
	common.ApiErrorMsg(c, "transfer-quota is deprecated; set workspace quota_limit via PUT /api/workspaces/:id")
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
	case errors.Is(err, model.ErrInvalidQuotaLimit):
		common.ApiErrorMsg(c, "quota limit must be non-negative")
	case errors.Is(err, model.ErrQuotaLimitBelowOccupied):
		common.ApiErrorMsg(c, err.Error())
	case errors.Is(err, model.ErrCustomerQuotaLimitExceeded):
		common.ApiErrorMsg(c, "workspace limits would exceed customer quota limit")
	case errors.Is(err, model.ErrCannotDisableDefaultWorkspace):
		common.ApiErrorMsg(c, "cannot disable the default workspace")
	case errors.Is(err, model.ErrWorkspaceNameRequired):
		common.ApiErrorMsg(c, "workspace name is required")
	case errors.Is(err, service.ErrCustomerForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
	default:
		common.ApiError(c, err)
	}
}
