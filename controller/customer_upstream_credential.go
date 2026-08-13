/*
Copyright (C) 2023-2026 QuantumNous
*/
package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type createUpstreamCredentialRequest struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	BaseURL  string `json:"base_url"`
	Key      string `json:"key"`
	Models   string `json:"models"`
	Priority int    `json:"priority"`
	Status   *int   `json:"status"`
}

type updateUpstreamCredentialRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	BaseURL  *string `json:"base_url"`
	Key      *string `json:"key"`
	Models   *string `json:"models"`
	Priority *int    `json:"priority"`
	Status   *int    `json:"status"`
}

// GetCustomerUpstreamCredentials lists BYOK credentials (hint only; admin+/root).
func GetCustomerUpstreamCredentials(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows, err := model.ListCustomerUpstreamCredentials(customerId)
	if err != nil {
		writeCredentialErr(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

// CreateCustomerUpstreamCredential creates an encrypted BYOK credential (admin+/root).
func CreateCustomerUpstreamCredential(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req createUpstreamCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	operatorId := c.GetInt("id")
	dto, err := model.CreateCustomerUpstreamCredential(customerId, operatorId, model.CreateUpstreamCredentialInput{
		Name:     req.Name,
		Type:     req.Type,
		BaseURL:  req.BaseURL,
		Key:      req.Key,
		Models:   req.Models,
		Priority: req.Priority,
		Status:   req.Status,
	})
	if err != nil {
		writeCredentialErr(c, err)
		return
	}
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("create upstream credential id=%d customer=%d", dto.Id, customerId),
		c.ClientIP(),
		"customer.upstream_credential.create",
		map[string]interface{}{
			"customer_id":   customerId,
			"credential_id": dto.Id,
			"name":          dto.Name,
			"type":          dto.Type,
			"key_hint":      dto.KeyHint,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, dto)
}

// UpdateCustomerUpstreamCredential updates / rotates a credential (admin+/root).
func UpdateCustomerUpstreamCredential(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	credentialId, err := strconv.Atoi(c.Param("cid"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req updateUpstreamCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Name == nil && req.Type == nil && req.BaseURL == nil && req.Key == nil &&
		req.Models == nil && req.Priority == nil && req.Status == nil {
		common.ApiErrorMsg(c, "no fields to update")
		return
	}
	dto, err := model.UpdateCustomerUpstreamCredential(customerId, credentialId, model.UpdateUpstreamCredentialInput{
		Name:     req.Name,
		Type:     req.Type,
		BaseURL:  req.BaseURL,
		Key:      req.Key,
		Models:   req.Models,
		Priority: req.Priority,
		Status:   req.Status,
	})
	if err != nil {
		writeCredentialErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	rotated := req.Key != nil && strings.TrimSpace(*req.Key) != ""
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("update upstream credential id=%d customer=%d rotated=%v", credentialId, customerId, rotated),
		c.ClientIP(),
		"customer.upstream_credential.update",
		map[string]interface{}{
			"customer_id":   customerId,
			"credential_id": credentialId,
			"rotated":       rotated,
			"key_hint":      dto.KeyHint,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, dto)
}

// DeleteCustomerUpstreamCredential deletes a credential (admin+/root).
func DeleteCustomerUpstreamCredential(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	credentialId, err := strconv.Atoi(c.Param("cid"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteCustomerUpstreamCredential(customerId, credentialId); err != nil {
		writeCredentialErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("delete upstream credential id=%d customer=%d", credentialId, customerId),
		c.ClientIP(),
		"customer.upstream_credential.delete",
		map[string]interface{}{
			"customer_id":   customerId,
			"credential_id": credentialId,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, gin.H{"id": credentialId})
}

// TestCustomerUpstreamCredential verifies stored key decrypts (optional connectivity).
func TestCustomerUpstreamCredential(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	credentialId, err := strconv.Atoi(c.Param("cid"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.TestCustomerUpstreamCredential(customerId, credentialId); err != nil {
		writeCredentialErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("test upstream credential id=%d customer=%d", credentialId, customerId),
		c.ClientIP(),
		"customer.upstream_credential.test",
		map[string]interface{}{
			"customer_id":   customerId,
			"credential_id": credentialId,
			"result":        "decrypt_ok",
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, gin.H{
		"ok":      true,
		"message": "credential decryptable",
	})
}

func writeCredentialErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, model.ErrUpstreamCredentialNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "upstream credential not found"})
	case errors.Is(err, model.ErrByokNotEnabled):
		common.ApiErrorMsg(c, "byok is not enabled for this customer")
	case errors.Is(err, model.ErrUpstreamCredentialKeyRequired):
		common.ApiErrorMsg(c, "upstream key is required")
	case errors.Is(err, model.ErrUpstreamCredentialInvalid):
		common.ApiErrorMsg(c, "invalid upstream credential")
	case errors.Is(err, common.ErrCiphertextInvalid), errors.Is(err, common.ErrCiphertextEmpty):
		common.ApiErrorMsg(c, "stored credential is invalid")
	default:
		common.ApiError(c, err)
	}
}
