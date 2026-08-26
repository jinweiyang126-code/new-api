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

type orgWalletAmountRequest struct {
	UserId int `json:"user_id"`
	Amount int `json:"amount"`
}

type orgWalletView struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id"`
	CustomerId    int    `json:"customer_id"`
	WorkspaceId   int    `json:"workspace_id"`
	Balance       int    `json:"balance"`
	UsedQuota     int    `json:"used_quota"`
	RequestCount  int    `json:"request_count"`
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
	CustomerName  string `json:"customer_name,omitempty"`
	WorkspaceName string `json:"workspace_name,omitempty"`
	Username      string `json:"username,omitempty"`
}

// GetSelfOrgWallets lists the current user's organization wallets.
func GetSelfOrgWallets(c *gin.Context) {
	userId := c.GetInt("id")
	customerId, _ := strconv.Atoi(c.Query("customer_id"))
	rows, err := model.ListOrgWalletsByUser(userId, customerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, enrichOrgWallets(rows, false))
}

// GetSelfOrgWalletLedger lists allocate/revoke ledger rows for the current member.
func GetSelfOrgWalletLedger(c *gin.Context) {
	userId := c.GetInt("id")
	customerId, _ := strconv.Atoi(c.Query("customer_id"))
	workspaceId, _ := strconv.Atoi(c.Query("workspace_id"))
	pageInfo := common.GetPageQuery(c)
	rows, total, err := model.ListOrgWalletLedgerForUser(
		userId,
		customerId,
		workspaceId,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": rows,
		"total": total,
	})
}

// GetWorkspaceOrgWallets lists org wallets in a workspace (customer admin).
func GetWorkspaceOrgWallets(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !requireCustomerAdminForWorkspace(c, workspaceId) {
		return
	}
	rows, err := model.ListOrgWalletsByWorkspace(workspaceId)
	if err != nil {
		writeOrgWalletErr(c, err)
		return
	}
	common.ApiSuccess(c, enrichOrgWallets(rows, true))
}

// AllocateOrgWallet allocates workspace allocatable quota into a member org wallet.
func AllocateOrgWallet(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !requireCustomerAdminForWorkspace(c, workspaceId) {
		return
	}
	var req orgWalletAmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}
	if _, err := model.GetWorkspaceMember(workspaceId, req.UserId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "user is not a workspace member")
			return
		}
		common.ApiError(c, err)
		return
	}
	wallet, err := model.AllocateOrgWalletBalance(req.UserId, workspaceId, req.Amount)
	if err != nil {
		writeOrgWalletErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	ws, _ := model.GetWorkspaceById(workspaceId)
	customerId := 0
	if ws != nil {
		customerId = ws.CustomerId
	}
	model.RecordOrgWalletLedgerLog(
		req.UserId,
		customerId,
		workspaceId,
		model.OrgWalletLedgerCredit,
		req.Amount,
		operatorId,
		c.ClientIP(),
	)
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("allocate org wallet workspace=%d user=%d amount=%d", workspaceId, req.UserId, req.Amount),
		c.ClientIP(),
		"org_wallet.allocate",
		map[string]interface{}{"workspace_id": workspaceId, "user_id": req.UserId, "amount": req.Amount},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, enrichOrgWallet(wallet, true))
}

// RevokeOrgWallet revokes amount from a member org wallet back to allocatable.
func RevokeOrgWallet(c *gin.Context) {
	workspaceId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !requireCustomerAdminForWorkspace(c, workspaceId) {
		return
	}
	var req orgWalletAmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}
	wallet, err := model.RevokeOrgWalletBalance(req.UserId, workspaceId, req.Amount)
	if err != nil {
		writeOrgWalletErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	ws, _ := model.GetWorkspaceById(workspaceId)
	customerId := 0
	if ws != nil {
		customerId = ws.CustomerId
	}
	model.RecordOrgWalletLedgerLog(
		req.UserId,
		customerId,
		workspaceId,
		model.OrgWalletLedgerDebit,
		req.Amount,
		operatorId,
		c.ClientIP(),
	)
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("revoke org wallet workspace=%d user=%d amount=%d", workspaceId, req.UserId, req.Amount),
		c.ClientIP(),
		"org_wallet.revoke",
		map[string]interface{}{"workspace_id": workspaceId, "user_id": req.UserId, "amount": req.Amount},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, enrichOrgWallet(wallet, true))
}

func requireCustomerAdminForWorkspace(c *gin.Context, workspaceId int) bool {
	ws, err := model.GetWorkspaceById(workspaceId)
	if err != nil {
		writeOrgWalletErr(c, err)
		return false
	}
	_, err = service.RequireCustomerAdmin(c.GetInt("id"), c.GetInt("role"), ws.CustomerId)
	if err != nil {
		if errors.Is(err, service.ErrCustomerForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
			return false
		}
		common.ApiError(c, err)
		return false
	}
	return true
}

func enrichOrgWallets(rows []*model.OrganizationWallet, withUsername bool) []*orgWalletView {
	out := make([]*orgWalletView, 0, len(rows))
	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.UserId)
	}
	nameByID := map[int]string{}
	if withUsername && len(ids) > 0 {
		if names, err := model.UsernamesByIDs(ids); err == nil {
			nameByID = names
		}
	}
	for _, row := range rows {
		view := enrichOrgWallet(row, false)
		if withUsername {
			view.Username = nameByID[row.UserId]
		}
		out = append(out, view)
	}
	return out
}

func enrichOrgWallet(row *model.OrganizationWallet, withUsername bool) *orgWalletView {
	if row == nil {
		return nil
	}
	view := &orgWalletView{
		Id:          row.Id,
		UserId:      row.UserId,
		CustomerId:  row.CustomerId,
		WorkspaceId: row.WorkspaceId,
		Balance:     row.Balance,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
	if customer, err := model.GetCustomerById(row.CustomerId); err == nil && customer != nil {
		view.CustomerName = customer.Name
	}
	if ws, err := model.GetWorkspaceById(row.WorkspaceId); err == nil && ws != nil {
		view.WorkspaceName = ws.Name
	}
	if row.UserId > 0 && row.WorkspaceId > 0 {
		if used, err := model.SumUserWorkspaceTokenUsedQuota(row.UserId, row.WorkspaceId); err == nil {
			view.UsedQuota = used
		}
		if count, err := model.CountUserWorkspaceConsumeLogs(row.UserId, row.WorkspaceId); err == nil {
			view.RequestCount = count
		}
	}
	if withUsername && row.UserId > 0 {
		if names, err := model.UsernamesByIDs([]int{row.UserId}); err == nil {
			view.Username = names[row.UserId]
		}
	}
	return view
}

func writeOrgWalletErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrOrgWalletNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "organization wallet not found"})
	case errors.Is(err, model.ErrInvalidOrgWalletAmount):
		common.ApiErrorMsg(c, "amount must be positive")
	case errors.Is(err, model.ErrInsufficientWorkspaceQuota):
		common.ApiErrorMsg(c, "insufficient workspace allocatable quota")
	case errors.Is(err, model.ErrInsufficientOrgWalletBalance):
		common.ApiErrorMsg(c, "insufficient organization wallet balance")
	case errors.Is(err, model.ErrWorkspaceNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "workspace not found"})
	default:
		common.ApiError(c, err)
	}
}
