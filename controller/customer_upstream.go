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
)

type updateUpstreamSettingsRequest struct {
	UpstreamMode        *string `json:"upstream_mode"`
	AllowGlobalFallback *bool   `json:"allow_global_fallback"`
	ByokEnabled         *bool   `json:"byok_enabled"`
}

type createChannelBindingRequest struct {
	ChannelId    int    `json:"channel_id"`
	Priority     int    `json:"priority"`
	ModelMapping string `json:"model_mapping"`
}

// UpdateCustomerUpstreamSettings updates shared/dedicated/byok settings (root only).
func UpdateCustomerUpstreamSettings(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req updateUpstreamSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UpstreamMode == nil && req.AllowGlobalFallback == nil && req.ByokEnabled == nil {
		common.ApiErrorMsg(c, "no fields to update")
		return
	}
	mode := ""
	if req.UpstreamMode != nil {
		mode = *req.UpstreamMode
	}
	customer, err := model.UpdateCustomerUpstreamSettings(customerId, mode, req.AllowGlobalFallback, req.ByokEnabled)
	if err != nil {
		writeUpstreamErr(c, err)
		return
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("update customer upstream id=%d mode=%s byok=%v fallback=%v",
			customerId, customer.UpstreamMode, customer.ByokEnabled, customer.AllowGlobalFallback),
		c.ClientIP(),
		"customer.upstream_settings",
		map[string]interface{}{
			"customer_id":            customerId,
			"upstream_mode":          customer.UpstreamMode,
			"byok_enabled":           customer.ByokEnabled,
			"allow_global_fallback":  customer.AllowGlobalFallback,
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

// GetCustomerChannelBindings lists dedicated channel bindings (root only).
func GetCustomerChannelBindings(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows, err := model.ListCustomerChannelBindings(customerId)
	if err != nil {
		writeUpstreamErr(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

// CreateCustomerChannelBinding binds a channel to a customer (root only).
func CreateCustomerChannelBinding(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req createChannelBindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	row, err := model.CreateCustomerChannelBinding(customerId, req.ChannelId, req.Priority, req.ModelMapping)
	if err != nil {
		writeUpstreamErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("bind channel %d to customer %d", req.ChannelId, customerId),
		c.ClientIP(),
		"customer.channel_binding.create",
		map[string]interface{}{
			"customer_id": customerId,
			"channel_id":  req.ChannelId,
			"binding_id":  row.Id,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, row)
}

// DeleteCustomerChannelBinding removes a channel binding (root only).
func DeleteCustomerChannelBinding(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	bindingId, err := strconv.Atoi(c.Param("bindingId"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteCustomerChannelBinding(customerId, bindingId); err != nil {
		writeUpstreamErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("unbind channel binding %d from customer %d", bindingId, customerId),
		c.ClientIP(),
		"customer.channel_binding.delete",
		map[string]interface{}{
			"customer_id": customerId,
			"binding_id":  bindingId,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, gin.H{"id": bindingId})
}

func writeUpstreamErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, model.ErrInvalidUpstreamMode):
		common.ApiErrorMsg(c, "invalid upstream mode")
	case errors.Is(err, model.ErrInvalidChannelId):
		common.ApiErrorMsg(c, "invalid channel id")
	case errors.Is(err, model.ErrChannelBindingDuplicate):
		common.ApiErrorMsg(c, "channel already bound to customer")
	case errors.Is(err, model.ErrChannelBindingNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "channel binding not found"})
	default:
		common.ApiError(c, err)
	}
}
