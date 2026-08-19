package controller

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const maxSelfRegisterInvites = 10
const maxSelfRegisterOrgNameRunes = 128

type selfCreateCustomerRequest struct {
	OrganizationName string   `json:"organization_name"`
	InviteEmails     []string `json:"invite_emails"`
}

// SelfCreateCustomer lets a logged-in user with no customer create one (OAuth org path).
func SelfCreateCustomer(c *gin.Context) {
	if !common.CustomerSelfRegisterEnabled {
		common.ApiErrorMsg(c, "customer self-register is disabled")
		return
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}
	var req selfCreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	orgName, err := validateSelfRegisterOrgName(req.OrganizationName)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	customer, ws, err := provisionSelfServiceCustomer(c, userId, orgName, req.InviteEmails)
	if err != nil {
		writeCustomerErr(c, err)
		return
	}

	model.RecordOperationAuditLog(userId,
		fmt.Sprintf("self-create customer id=%d owner=%d", customer.Id, userId),
		c.ClientIP(),
		"customer.self_create",
		map[string]interface{}{
			"customer_id":   customer.Id,
			"owner_user_id": userId,
			"workspace_id":  ws.Id,
		},
		map[string]interface{}{
			"operator_id": userId,
			"node_name":   common.NodeName,
		},
		nil,
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, gin.H{
		"customer_id":  customer.Id,
		"workspace_id": ws.Id,
	})
}

func validateSelfRegisterOrgName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("organization name is required")
	}
	if utf8.RuneCountInString(name) > maxSelfRegisterOrgNameRunes {
		return "", errors.New("organization name is too long")
	}
	return name, nil
}

func normalizeSelfRegisterInviteEmails(emails []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(emails))
	for _, raw := range emails {
		email := model.NormalizeEmail(raw)
		if email == "" {
			continue
		}
		if err := common.Validate.Var(email, "email"); err != nil {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		out = append(out, email)
		if len(out) >= maxSelfRegisterInvites {
			break
		}
	}
	return out
}

func provisionSelfServiceCustomer(c *gin.Context, ownerUserId int, orgName string, inviteEmails []string) (*model.Customer, *model.Workspace, error) {
	customer := &model.Customer{Name: orgName}
	ws, err := model.CreateCustomerWithOwner(customer, ownerUserId)
	if err != nil {
		return nil, nil, err
	}
	createSelfRegisterInvitations(c, customer, ownerUserId, inviteEmails)
	return customer, ws, nil
}

func createSelfRegisterInvitations(c *gin.Context, customer *model.Customer, ownerUserId int, inviteEmails []string) {
	if customer == nil {
		return
	}
	emails := normalizeSelfRegisterInviteEmails(inviteEmails)
	if len(emails) == 0 {
		return
	}
	ownerEmail := ""
	if owner, err := model.GetUserById(ownerUserId, false); err == nil && owner != nil {
		ownerEmail = model.NormalizeEmail(owner.Email)
	}
	for _, email := range emails {
		if ownerEmail != "" && email == ownerEmail {
			continue
		}
		inv, err := model.CreateInvitation(model.CreateInvitationInput{
			CustomerId: customer.Id,
			Email:      email,
			Role:       model.CustomerRoleMember,
			InvitedBy:  ownerUserId,
		})
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf(
				"self-register invitation failed customer_id=%d email=%s: %s",
				customer.Id, email, err.Error(),
			))
			continue
		}
		if _, mailErr := service.SendCustomerInvitationEmail(inv, customer.Name); mailErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf(
				"failed to send self-register invitation email invitation_id=%d to %s: %s",
				inv.Id, email, mailErr.Error(),
			))
		}
	}
}
