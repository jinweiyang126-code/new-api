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
	"github.com/QuantumNous/new-api/service"

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

type fetchCustomerUpstreamModelsRequest struct {
	Type         string `json:"type"`
	Key          string `json:"key"`
	BaseURL      string `json:"base_url"`
	CredentialID int    `json:"credential_id"`
}

// FetchCustomerUpstreamModels lists upstream model IDs for a BYOK credential preview
// (form key) or a saved credential (stored key). Customer-admin scoped; does not use
// channel admin APIs.
func FetchCustomerUpstreamModels(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	customer, err := model.GetCustomerById(customerId)
	if err != nil {
		writeCredentialErr(c, err)
		return
	}
	if !customer.ByokEnabled {
		writeCredentialErr(c, model.ErrByokNotEnabled)
		return
	}

	var req fetchCustomerUpstreamModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	key := strings.TrimSpace(req.Key)
	typeStr := strings.TrimSpace(req.Type)
	baseURL := strings.TrimSpace(req.BaseURL)

	if req.CredentialID > 0 {
		row, err := model.GetCustomerUpstreamCredential(customerId, req.CredentialID)
		if err != nil {
			writeCredentialErr(c, err)
			return
		}
		if typeStr == "" {
			typeStr = row.Type
		}
		if baseURL == "" {
			baseURL = row.BaseURL
		}
		if key == "" {
			plain, err := model.DecryptCustomerUpstreamCredentialKey(customerId, req.CredentialID)
			if err != nil {
				writeCredentialErr(c, err)
				return
			}
			key = strings.TrimSpace(plain)
		}
	}

	if key == "" {
		common.ApiErrorMsg(c, "upstream key is required")
		return
	}

	channelType := service.ResolveByokChannelType(typeStr)
	if baseURL == "" && channelType >= 0 && channelType < len(constant.ChannelBaseURLs) {
		baseURL = constant.ChannelBaseURLs[channelType]
	}
	key = strings.Split(key, "\n")[0]

	channel := &model.Channel{
		Type:    channelType,
		Key:     key,
		BaseURL: &baseURL,
	}
	ids, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("获取模型列表失败: %s", err.Error()),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    ids,
	})
}

type reorderUpstreamCredentialsRequest struct {
	OrderedIds []int `json:"ordered_ids"`
}

// ReorderCustomerUpstreamCredentials sets credential priority by list order (first = highest).
func ReorderCustomerUpstreamCredentials(c *gin.Context) {
	customerId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req reorderUpstreamCredentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	rows, err := model.ReorderCustomerUpstreamCredentials(customerId, req.OrderedIds)
	if err != nil {
		writeCredentialErr(c, err)
		return
	}
	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("reorder upstream credentials customer=%d count=%d", customerId, len(req.OrderedIds)),
		c.ClientIP(),
		"customer.upstream_credential.reorder",
		map[string]interface{}{
			"customer_id": customerId,
			"ordered_ids": req.OrderedIds,
		},
		map[string]interface{}{
			"operator_id": operatorId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, rows)
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
