package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createCustomerRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Remark      string `json:"remark"`
	OwnerUserId int    `json:"owner_user_id"`
}

type updateCustomerRequest struct {
	Name   *string `json:"name"`
	Remark *string `json:"remark"`
	Status *int    `json:"status"`
}

type setCustomerQuotaLimitRequest struct {
	QuotaLimit int `json:"quota_limit"`
}

// GetCustomers lists customers. Root sees all (paginated); others see only their own.
func GetCustomers(c *gin.Context) {
	userId := c.GetInt("id")
	systemRole := c.GetInt("role")
	pageInfo := common.GetPageQuery(c)

	if service.IsRootUser(systemRole) {
		keyword := strings.TrimSpace(c.Query("keyword"))
		status := -1
		if raw := strings.TrimSpace(c.Query("status")); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil {
				status = parsed
			}
		}
		customers, total, err := model.GetAllCustomers(
			pageInfo.GetStartIdx(),
			pageInfo.GetPageSize(),
			keyword,
			status,
			c.Query("sort_by"),
			c.Query("sort_order"),
		)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(customers)
		common.ApiSuccess(c, pageInfo)
		return
	}

	_, customerId, err := service.GetUserCustomerRole(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if customerId <= 0 {
		pageInfo.SetTotal(0)
		pageInfo.SetItems([]*model.CustomerView{})
		common.ApiSuccess(c, pageInfo)
		return
	}
	customer, err := model.GetCustomerViewById(customerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(1)
	pageInfo.SetItems([]*model.CustomerView{customer})
	common.ApiSuccess(c, pageInfo)
}

// CreateCustomer creates a customer (root only). Route should use RootAuth.
func CreateCustomer(c *gin.Context) {
	var req createCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	customer := &model.Customer{
		Name:   req.Name,
		Slug:   req.Slug,
		Remark: req.Remark,
	}
	ws, err := model.CreateCustomerWithOwner(customer, req.OwnerUserId)
	if err != nil {
		writeCustomerErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("create customer id=%d owner=%d", customer.Id, req.OwnerUserId),
		c.ClientIP(),
		"customer.create",
		map[string]interface{}{
			"customer_id":   customer.Id,
			"owner_user_id": req.OwnerUserId,
			"workspace_id":  ws.Id,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)

	common.ApiSuccess(c, gin.H{
		"customer":  customer,
		"workspace": ws,
	})
}

// GetCustomer returns customer detail. Membership enforced by middleware.
func GetCustomer(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	customer, err := model.GetCustomerViewById(customerId)
	if err != nil {
		writeCustomerErr(c, err)
		return
	}
	common.ApiSuccess(c, customer)
}

// UpdateCustomer updates name/remark (customer admin+) or status (root only).
func UpdateCustomer(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req updateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	systemRole := c.GetInt("role")
	isRoot := service.IsRootUser(systemRole)

	if req.Status != nil && !isRoot {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "only root can change customer status",
		})
		return
	}

	if !isRoot {
		if _, err := service.RequireCustomerAdmin(userId, systemRole, customerId); err != nil {
			if errors.Is(err, service.ErrCustomerForbidden) {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
				return
			}
			writeCustomerErr(c, err)
			return
		}
	}

	if req.Name == nil && req.Remark == nil && req.Status == nil {
		common.ApiErrorMsg(c, "no fields to update")
		return
	}

	customer, err := model.UpdateCustomerFields(customerId, req.Name, req.Remark, req.Status)
	if err != nil {
		writeCustomerErr(c, err)
		return
	}
	common.ApiSuccess(c, customer)
}

// SetCustomerQuotaLimit sets the customer quota ceiling (root only).
// Replaces the old pool "topup" semantics.
func SetCustomerQuotaLimit(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req setCustomerQuotaLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	customer, err := model.SetCustomerQuotaLimit(customerId, req.QuotaLimit)
	if err != nil {
		writeCustomerErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	content := fmt.Sprintf("customer set quota_limit id=%d limit=%s",
		customerId, logger.LogQuota(req.QuotaLimit))
	model.RecordLog(operatorId, model.LogTypeManage, content)
	model.RecordOperationAuditLog(operatorId, content, c.ClientIP(), "customer.set_quota_limit",
		map[string]interface{}{
			"customer_id": customerId,
			"quota_limit": req.QuotaLimit,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)

	common.ApiSuccess(c, customer)
}

// TopUpCustomer is kept as a compatibility alias that rejects incremental topup.
func TopUpCustomer(c *gin.Context) {
	common.ApiErrorMsg(c, "topup is deprecated; use POST /api/customers/:id/quota-limit with {quota_limit}")
}

// GetCustomerWorkspaces lists workspaces under a customer. Membership via middleware.
func GetCustomerWorkspaces(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	workspaces, err := model.GetWorkspacesByCustomerId(customerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, workspaces)
}

func writeCustomerErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrOwnerAlreadyHasCustomer):
		common.ApiErrorMsg(c, "owner already belongs to a customer")
	case errors.Is(err, model.ErrCustomerSlugDuplicated):
		common.ApiErrorMsg(c, "customer slug already exists")
	case errors.Is(err, model.ErrCustomerNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, model.ErrInvalidTopupAmount):
		common.ApiErrorMsg(c, "topup amount must be positive")
	case errors.Is(err, model.ErrInvalidQuotaLimit):
		common.ApiErrorMsg(c, "quota limit must be non-negative")
	case errors.Is(err, model.ErrQuotaLimitBelowOccupied):
		common.ApiErrorMsg(c, err.Error())
	case errors.Is(err, model.ErrCustomerQuotaLimitExceeded):
		common.ApiErrorMsg(c, "workspace limits would exceed customer quota limit")
	case errors.Is(err, service.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, service.ErrCustomerForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
	default:
		common.ApiError(c, err)
	}
}
