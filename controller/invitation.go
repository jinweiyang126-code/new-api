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
)

type createInvitationRequest struct {
	Email         string `json:"email"`
	WorkspaceId   *int   `json:"workspace_id"`
	Role          string `json:"role"`
	WorkspaceRole string `json:"workspace_role"`
	ExpiresAt     int64  `json:"expires_at"`
}

type createInvitationResponse struct {
	*model.CustomerInvitation
	EmailSent  bool   `json:"email_sent"`
	EmailError string `json:"email_error,omitempty"`
}

// CreateCustomerInvitation creates an invite (customer admin+).
// When email is provided and SMTP is configured, sends the accept link (failure does not roll back the invite).
func CreateCustomerInvitation(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	var req createInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	email := model.NormalizeEmail(req.Email)
	if email != "" {
		if err := common.Validate.Var(email, "email"); err != nil {
			common.ApiErrorMsg(c, "invalid invitation email")
			return
		}
	}
	inv, err := model.CreateInvitation(model.CreateInvitationInput{
		CustomerId:    customerId,
		WorkspaceId:   req.WorkspaceId,
		Email:         email,
		Role:          req.Role,
		WorkspaceRole: req.WorkspaceRole,
		InvitedBy:     c.GetInt("id"),
		ExpiresAt:     req.ExpiresAt,
	})
	if err != nil {
		writeInvitationErr(c, err)
		return
	}

	resp := &createInvitationResponse{CustomerInvitation: inv}
	if email != "" {
		customerName := ""
		if customer, cerr := model.GetCustomerById(customerId); cerr == nil && customer != nil {
			customerName = customer.Name
		}
		sent, mailErr := service.SendCustomerInvitationEmail(inv, customerName)
		resp.EmailSent = sent
		if mailErr != nil {
			resp.EmailError = mailErr.Error()
			logger.LogError(c.Request.Context(), fmt.Sprintf(
				"failed to send invitation email invitation_id=%d to %s: %s",
				inv.Id, email, mailErr.Error(),
			))
		} else if !sent {
			resp.EmailError = "SMTP not configured"
		}
	}

	operatorId := c.GetInt("id")
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("create invitation id=%d customer=%d email_sent=%v", inv.Id, customerId, resp.EmailSent),
		c.ClientIP(),
		"customer.invitation.create",
		map[string]interface{}{
			"invitation_id": inv.Id,
			"customer_id":   customerId,
			"email_sent":    resp.EmailSent,
			"has_email":     strings.TrimSpace(email) != "",
		},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, resp)
}

// GetCustomerInvitations lists invitations for a customer.
func GetCustomerInvitations(c *gin.Context) {
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		customerId = id
	}
	list, err := model.ListCustomerInvitations(customerId)
	if err != nil {
		writeInvitationErr(c, err)
		return
	}
	common.ApiSuccess(c, list)
}

// AcceptInvitation accepts a pending invite by token (logged-in user).
func AcceptInvitation(c *gin.Context) {
	token := c.Param("id") // path param shares name with revoke; value is invite token
	userId := c.GetInt("id")
	inv, err := model.AcceptInvitation(token, userId)
	if err != nil {
		writeInvitationErr(c, err)
		return
	}
	common.ApiSuccess(c, inv)
}

// RevokeInvitation revokes a pending invite by id (customer admin+ of that invite).
func RevokeInvitation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	inv, err := model.GetInvitationById(id)
	if err != nil {
		writeInvitationErr(c, err)
		return
	}
	userId := c.GetInt("id")
	systemRole := c.GetInt("role")
	if _, err := service.RequireCustomerAdmin(userId, systemRole, inv.CustomerId); err != nil {
		if errors.Is(err, service.ErrCustomerForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
			return
		}
		writeInvitationErr(c, err)
		return
	}
	inv, err = model.RevokeInvitation(id)
	if err != nil {
		writeInvitationErr(c, err)
		return
	}

	operatorId := userId
	model.RecordOperationAuditLog(operatorId,
		fmt.Sprintf("revoke invitation id=%d customer=%d", id, inv.CustomerId),
		c.ClientIP(),
		"customer.invitation.revoke",
		map[string]interface{}{"invitation_id": id, "customer_id": inv.CustomerId},
		map[string]interface{}{"operator_id": operatorId, "node_name": common.NodeName},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, inv)
}

func writeInvitationErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrInvitationNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "invitation not found"})
	case errors.Is(err, model.ErrInvitationExpired):
		common.ApiErrorMsg(c, "invitation has expired")
	case errors.Is(err, model.ErrInvitationRevoked):
		common.ApiErrorMsg(c, "invitation has been revoked")
	case errors.Is(err, model.ErrInvitationNotPending):
		common.ApiErrorMsg(c, "invitation is not pending")
	case errors.Is(err, model.ErrUserAlreadyHasCustomer):
		common.ApiErrorMsg(c, "user already belongs to a customer")
	case errors.Is(err, model.ErrInvitationWorkspaceInvalid):
		common.ApiErrorMsg(c, "workspace does not belong to this customer")
	case errors.Is(err, model.ErrInvalidMemberRole):
		common.ApiErrorMsg(c, "invalid invitation role")
	case errors.Is(err, model.ErrCustomerNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "customer not found"})
	case errors.Is(err, model.ErrWorkspaceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "workspace not found"})
	case errors.Is(err, model.ErrWorkspaceDisabled):
		common.ApiErrorMsg(c, "workspace is disabled")
	default:
		common.ApiError(c, err)
	}
}
