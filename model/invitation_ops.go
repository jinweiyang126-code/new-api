package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	DefaultInvitationTTL = 7 * 24 * time.Hour
)

var (
	ErrInvitationNotFound         = errors.New("invitation not found")
	ErrInvitationNotPending       = errors.New("invitation is not pending")
	ErrInvitationExpired          = errors.New("invitation has expired")
	ErrInvitationRevoked          = errors.New("invitation has been revoked")
	ErrUserAlreadyHasCustomer     = errors.New("user already belongs to a customer") // legacy; unused for cross-customer
	ErrAlreadyCustomerMember      = errors.New("user is already a member of this customer")
	ErrInvitationWorkspaceRequired = errors.New("invitation workspace_id is required")
	ErrInvitationWorkspaceInvalid = errors.New("workspace does not belong to this customer")
)

// CreateInvitationInput holds fields for creating a customer invitation.
type CreateInvitationInput struct {
	CustomerId    int
	WorkspaceId   *int
	Email         string
	Role          string
	WorkspaceRole string
	InvitedBy     int
	ExpiresAt     int64 // 0 => now + DefaultInvitationTTL
}

// CreateInvitation creates a pending invite with a unique token.
func CreateInvitation(in CreateInvitationInput) (*CustomerInvitation, error) {
	if in.CustomerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	role := strings.TrimSpace(in.Role)
	if role == "" {
		role = CustomerRoleMember
	}
	if role == CustomerRoleOwner || !IsValidCustomerRole(role) {
		return nil, ErrInvalidMemberRole
	}
	wsRole := strings.TrimSpace(in.WorkspaceRole)
	if wsRole == "" {
		wsRole = WorkspaceRoleMember
	}
	if !IsValidWorkspaceRole(wsRole) {
		return nil, ErrInvalidMemberRole
	}

	var inv *CustomerInvitation
	err := DB.Transaction(func(tx *gorm.DB) error {
		var customer Customer
		if err := tx.Where("id = ?", in.CustomerId).First(&customer).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		if customer.Status != CustomerStatusEnabled {
			return errors.New("customer is disabled")
		}

		if in.WorkspaceId == nil || *in.WorkspaceId <= 0 {
			return ErrInvitationWorkspaceRequired
		}
		var ws Workspace
		if err := tx.Where("id = ? AND customer_id = ?", *in.WorkspaceId, in.CustomerId).First(&ws).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvitationWorkspaceInvalid
			}
			return err
		}
		if ws.Status != CustomerStatusEnabled {
			return ErrWorkspaceDisabled
		}

		expiresAt := in.ExpiresAt
		now := common.GetTimestamp()
		if expiresAt <= 0 {
			expiresAt = now + int64(DefaultInvitationTTL.Seconds())
		}

		token := common.GetRandomString(48)
		row := &CustomerInvitation{
			CustomerId:    in.CustomerId,
			WorkspaceId:   in.WorkspaceId,
			Email:         NormalizeEmail(in.Email),
			Token:         token,
			Role:          role,
			WorkspaceRole: wsRole,
			InvitedBy:     in.InvitedBy,
			Status:        InvitationStatusPending,
			ExpiresAt:     expiresAt,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := tx.Create(row).Error; err != nil {
			return err
		}
		inv = row
		return nil
	})
	return inv, err
}

// ListCustomerInvitations lists invitations for a customer (newest first).
func ListCustomerInvitations(customerId int) ([]*CustomerInvitation, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	var list []*CustomerInvitation
	err := DB.Where("customer_id = ?", customerId).Order("id desc").Find(&list).Error
	return list, err
}

// GetInvitationByToken loads an invitation by token.
func GetInvitationByToken(token string) (*CustomerInvitation, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrInvitationNotFound
	}
	var inv CustomerInvitation
	err := DB.Where("token = ?", token).First(&inv).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}
	return &inv, nil
}

// GetInvitationById loads an invitation by id.
func GetInvitationById(id int) (*CustomerInvitation, error) {
	if id <= 0 {
		return nil, ErrInvitationNotFound
	}
	var inv CustomerInvitation
	err := DB.Where("id = ?", id).First(&inv).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}
	return &inv, nil
}

// RevokeInvitation marks a pending invitation as revoked.
func RevokeInvitation(id int) (*CustomerInvitation, error) {
	inv, err := GetInvitationById(id)
	if err != nil {
		return nil, err
	}
	if inv.Status == InvitationStatusRevoked {
		return inv, nil
	}
	if inv.Status != InvitationStatusPending {
		return nil, ErrInvitationNotPending
	}
	now := common.GetTimestamp()
	if err := DB.Model(inv).Updates(map[string]interface{}{
		"status":     InvitationStatusRevoked,
		"updated_at": now,
	}).Error; err != nil {
		return nil, err
	}
	inv.Status = InvitationStatusRevoked
	inv.UpdatedAt = now
	return inv, nil
}

// AcceptInvitation joins the user to the customer and target/default workspace.
func AcceptInvitation(token string, userId int) (*CustomerInvitation, error) {
	if userId <= 0 {
		return nil, errors.New("user id is required")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrInvitationNotFound
	}

	var accepted *CustomerInvitation
	err := DB.Transaction(func(tx *gorm.DB) error {
		var inv CustomerInvitation
		if err := lockForUpdate(tx).Where("token = ?", token).First(&inv).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvitationNotFound
			}
			return err
		}

		now := common.GetTimestamp()
		switch inv.Status {
		case InvitationStatusRevoked:
			return ErrInvitationRevoked
		case InvitationStatusAccepted:
			return ErrInvitationNotPending
		case InvitationStatusExpired:
			return ErrInvitationExpired
		case InvitationStatusPending:
			// ok
		default:
			return ErrInvitationNotPending
		}
		if inv.ExpiresAt > 0 && now > inv.ExpiresAt {
			_ = tx.Model(&inv).Updates(map[string]interface{}{
				"status": InvitationStatusExpired, "updated_at": now,
			})
			return ErrInvitationExpired
		}

		var user User
		if err := lockForUpdate(tx).Select("id", "customer_id", "status").
			Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			return errors.New("user is disabled")
		}

		var customer Customer
		if err := tx.Where("id = ?", inv.CustomerId).First(&customer).Error; err != nil {
			return err
		}
		if customer.Status != CustomerStatusEnabled {
			return errors.New("customer is disabled")
		}

		// Same customer membership already exists → reject (P3).
		var existingMember CustomerMember
		err := tx.Where("customer_id = ? AND user_id = ? AND status = ?",
			inv.CustomerId, userId, MemberStatusEnabled).First(&existingMember).Error
		if err == nil {
			return ErrAlreadyCustomerMember
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		workspaceId, err := resolveInvitationWorkspaceID(tx, &inv)
		if err != nil {
			return err
		}

		if err := upsertCustomerMemberTx(tx, inv.CustomerId, userId, inv.Role, now); err != nil {
			return err
		}
		if err := upsertWorkspaceMemberTx(tx, workspaceId, userId, inv.WorkspaceRole, now); err != nil {
			return err
		}
		// Switch current customer pointer to the newly joined customer (multi-customer OK).
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("customer_id", inv.CustomerId).Error; err != nil {
			return err
		}
		if err := tx.Model(&inv).Updates(map[string]interface{}{
			"status":     InvitationStatusAccepted,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		inv.Status = InvitationStatusAccepted
		inv.UpdatedAt = now
		accepted = &inv
		return nil
	})
	return accepted, err
}

func resolveInvitationWorkspaceID(tx *gorm.DB, inv *CustomerInvitation) (int, error) {
	if inv.WorkspaceId == nil || *inv.WorkspaceId <= 0 {
		return 0, ErrInvitationWorkspaceRequired
	}
	var ws Workspace
	if err := tx.Where("id = ? AND customer_id = ?", *inv.WorkspaceId, inv.CustomerId).First(&ws).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrInvitationWorkspaceInvalid
		}
		return 0, err
	}
	if ws.Status != CustomerStatusEnabled {
		return 0, ErrWorkspaceDisabled
	}
	return ws.Id, nil
}

func upsertCustomerMemberTx(tx *gorm.DB, customerId, userId int, role string, now int64) error {
	var existing CustomerMember
	err := tx.Where("customer_id = ? AND user_id = ?", customerId, userId).First(&existing).Error
	if err == nil {
		return tx.Model(&existing).Updates(map[string]interface{}{
			"role": role, "status": MemberStatusEnabled, "updated_at": now,
		}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&CustomerMember{
		CustomerId: customerId,
		UserId:     userId,
		Role:       role,
		Status:     MemberStatusEnabled,
		CreatedAt:  now,
		UpdatedAt:  now,
	}).Error
}

func upsertWorkspaceMemberTx(tx *gorm.DB, workspaceId, userId int, role string, now int64) error {
	var existing WorkspaceMember
	err := tx.Where("workspace_id = ? AND user_id = ?", workspaceId, userId).First(&existing).Error
	if err == nil {
		return tx.Model(&existing).Updates(map[string]interface{}{
			"role": role, "status": MemberStatusEnabled, "updated_at": now,
		}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return tx.Create(&WorkspaceMember{
		WorkspaceId: workspaceId,
		UserId:      userId,
		Role:        role,
		Status:      MemberStatusEnabled,
		CreatedAt:   now,
		UpdatedAt:   now,
	}).Error
}
