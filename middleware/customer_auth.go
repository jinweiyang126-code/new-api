package middleware

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// CustomerMemberAuth requires the caller to be an active member of the customer
// identified by the path param (default "id"), or platform root.
func CustomerMemberAuth(paramNames ...string) gin.HandlerFunc {
	param := firstParamName(paramNames, "id")
	return func(c *gin.Context) {
		customerId, ok := parsePositiveIntParam(c, param)
		if !ok {
			abortCustomerAuth(c, http.StatusBadRequest, "invalid customer id")
			return
		}
		role, err := service.RequireCustomerMember(c.GetInt("id"), c.GetInt("role"), customerId)
		if abortCustomerAuthErr(c, err) {
			return
		}
		common.SetContextKey(c, constant.ContextKeyCustomerId, customerId)
		common.SetContextKey(c, constant.ContextKeyCustomerRole, role)
		c.Next()
	}
}

// CustomerAdminAuth requires customer owner/admin, or platform root.
func CustomerAdminAuth(paramNames ...string) gin.HandlerFunc {
	param := firstParamName(paramNames, "id")
	return func(c *gin.Context) {
		customerId, ok := parsePositiveIntParam(c, param)
		if !ok {
			abortCustomerAuth(c, http.StatusBadRequest, "invalid customer id")
			return
		}
		role, err := service.RequireCustomerAdmin(c.GetInt("id"), c.GetInt("role"), customerId)
		if abortCustomerAuthErr(c, err) {
			return
		}
		common.SetContextKey(c, constant.ContextKeyCustomerId, customerId)
		common.SetContextKey(c, constant.ContextKeyCustomerRole, role)
		c.Next()
	}
}

// WorkspaceMemberAuth requires workspace access (customer admin or workspace member), or root.
func WorkspaceMemberAuth(paramNames ...string) gin.HandlerFunc {
	param := firstParamName(paramNames, "id")
	return func(c *gin.Context) {
		workspaceId, ok := parsePositiveIntParam(c, param)
		if !ok {
			abortCustomerAuth(c, http.StatusBadRequest, "invalid workspace id")
			return
		}
		wsRole, customerId, err := service.RequireWorkspaceMember(c.GetInt("id"), c.GetInt("role"), workspaceId)
		if abortCustomerAuthErr(c, err) {
			return
		}
		common.SetContextKey(c, constant.ContextKeyWorkspaceId, workspaceId)
		common.SetContextKey(c, constant.ContextKeyWorkspaceRole, wsRole)
		common.SetContextKey(c, constant.ContextKeyCustomerId, customerId)
		c.Next()
	}
}

// WorkspaceAdminAuth requires workspace admin (or customer owner/admin), or root.
func WorkspaceAdminAuth(paramNames ...string) gin.HandlerFunc {
	param := firstParamName(paramNames, "id")
	return func(c *gin.Context) {
		workspaceId, ok := parsePositiveIntParam(c, param)
		if !ok {
			abortCustomerAuth(c, http.StatusBadRequest, "invalid workspace id")
			return
		}
		wsRole, customerId, err := service.RequireWorkspaceAdmin(c.GetInt("id"), c.GetInt("role"), workspaceId)
		if abortCustomerAuthErr(c, err) {
			return
		}
		common.SetContextKey(c, constant.ContextKeyWorkspaceId, workspaceId)
		common.SetContextKey(c, constant.ContextKeyWorkspaceRole, wsRole)
		common.SetContextKey(c, constant.ContextKeyCustomerId, customerId)
		c.Next()
	}
}

func firstParamName(names []string, fallback string) string {
	if len(names) > 0 && names[0] != "" {
		return names[0]
	}
	return fallback
}

func parsePositiveIntParam(c *gin.Context, name string) (int, bool) {
	raw := c.Param(name)
	if raw == "" {
		raw = c.Query(name)
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func abortCustomerAuthErr(c *gin.Context, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, service.ErrCustomerNotFound) {
		abortCustomerAuth(c, http.StatusNotFound, err.Error())
		return true
	}
	if errors.Is(err, service.ErrCustomerForbidden) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"success": false,
			"code":    "AUTH_INSUFFICIENT_PRIVILEGE",
			"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
		})
		return true
	}
	abortCustomerAuth(c, http.StatusInternalServerError, err.Error())
	return true
}

func abortCustomerAuth(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{
		"success": false,
		"message": message,
	})
}
