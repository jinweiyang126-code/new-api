package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrOrgWalletNotFound           = errors.New("organization wallet not found")
	ErrInvalidOrgWalletAmount      = errors.New("organization wallet amount must be positive")
	ErrInsufficientWorkspaceQuota  = errors.New("insufficient workspace allocatable quota")
	ErrInsufficientOrgWalletBalance = errors.New("insufficient organization wallet balance")
)

// OrganizationWallet is a per-(user, customer, workspace) org billing balance.
type OrganizationWallet struct {
	Id          int   `json:"id"`
	UserId      int   `json:"user_id" gorm:"not null;uniqueIndex:uk_org_wallet_user_ws;index"`
	CustomerId  int   `json:"customer_id" gorm:"not null;index;column:customer_id"`
	WorkspaceId int   `json:"workspace_id" gorm:"not null;uniqueIndex:uk_org_wallet_user_ws;index;column:workspace_id"`
	Balance     int   `json:"balance" gorm:"bigint;default:0"`
	CreatedAt   int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64 `json:"updated_at" gorm:"bigint"`
}

func (OrganizationWallet) TableName() string {
	return "organization_wallets"
}

// GetOrCreateOrgWallet returns the wallet row for the triple, creating it if needed.
func GetOrCreateOrgWallet(userId, customerId, workspaceId int) (*OrganizationWallet, error) {
	if userId <= 0 || customerId <= 0 || workspaceId <= 0 {
		return nil, ErrOrgWalletNotFound
	}
	var wallet OrganizationWallet
	err := DB.Where("user_id = ? AND workspace_id = ?", userId, workspaceId).First(&wallet).Error
	if err == nil {
		return &wallet, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	now := common.GetTimestamp()
	wallet = OrganizationWallet{
		UserId:      userId,
		CustomerId:  customerId,
		WorkspaceId: workspaceId,
		Balance:     0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := DB.Create(&wallet).Error; err != nil {
		// race: fetch again
		var existing OrganizationWallet
		if e := DB.Where("user_id = ? AND workspace_id = ?", userId, workspaceId).First(&existing).Error; e == nil {
			return &existing, nil
		}
		return nil, err
	}
	return &wallet, nil
}

// ListOrgWalletsByUser lists org wallets for a user (optionally filtered by customer).
func ListOrgWalletsByUser(userId int, customerId int) ([]*OrganizationWallet, error) {
	tx := DB.Where("user_id = ?", userId)
	if customerId > 0 {
		tx = tx.Where("customer_id = ?", customerId)
	}
	var rows []*OrganizationWallet
	err := tx.Order("id desc").Find(&rows).Error
	return rows, err
}

// ListOrgWalletsByWorkspace lists all org wallets in a workspace.
func ListOrgWalletsByWorkspace(workspaceId int) ([]*OrganizationWallet, error) {
	if workspaceId <= 0 {
		return nil, nil
	}
	var rows []*OrganizationWallet
	err := DB.Where("workspace_id = ?", workspaceId).Order("id desc").Find(&rows).Error
	return rows, err
}

// ZeroOrgWalletsForUserWorkspaces clears balances for leave/remove (frees allocatable).
func ZeroOrgWalletsForUserWorkspaces(tx *gorm.DB, userId int, workspaceIDs []int) error {
	if userId <= 0 || len(workspaceIDs) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	return tx.Model(&OrganizationWallet{}).
		Where("user_id = ? AND workspace_id IN ?", userId, workspaceIDs).
		Updates(map[string]interface{}{
			"balance":    0,
			"updated_at": now,
		}).Error
}

// AllocateOrgWalletBalance moves amount from workspace allocatable into the member wallet.
func AllocateOrgWalletBalance(userId, workspaceId, amount int) (*OrganizationWallet, error) {
	if amount <= 0 {
		return nil, ErrInvalidOrgWalletAmount
	}
	var out *OrganizationWallet
	err := DB.Transaction(func(tx *gorm.DB) error {
		var ws Workspace
		if err := lockForUpdate(tx).Where("id = ?", workspaceId).First(&ws).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWorkspaceNotFound
			}
			return err
		}
		var occupied int64
		if err := tx.Model(&OrganizationWallet{}).
			Where("workspace_id = ?", workspaceId).
			Select("COALESCE(SUM(balance), 0)").
			Scan(&occupied).Error; err != nil {
			return err
		}
		allocatable := int64(ws.QuotaLimit) - occupied
		if int64(amount) > allocatable {
			return ErrInsufficientWorkspaceQuota
		}

		now := common.GetTimestamp()
		var wallet OrganizationWallet
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
			First(&wallet).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			wallet = OrganizationWallet{
				UserId:      userId,
				CustomerId:  ws.CustomerId,
				WorkspaceId: workspaceId,
				Balance:     amount,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := tx.Create(&wallet).Error; err != nil {
				return err
			}
			out = &wallet
			return nil
		}
		if err != nil {
			return err
		}
		if err := tx.Model(&OrganizationWallet{}).
			Where("id = ?", wallet.Id).
			Updates(map[string]interface{}{
				"balance":    gorm.Expr("balance + ?", amount),
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		wallet.Balance += amount
		wallet.UpdatedAt = now
		out = &wallet
		return nil
	})
	return out, err
}

// RevokeOrgWalletBalance returns amount from member wallet back to workspace allocatable.
func RevokeOrgWalletBalance(userId, workspaceId, amount int) (*OrganizationWallet, error) {
	if amount <= 0 {
		return nil, ErrInvalidOrgWalletAmount
	}
	var out *OrganizationWallet
	err := DB.Transaction(func(tx *gorm.DB) error {
		var wallet OrganizationWallet
		if err := lockForUpdate(tx).
			Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
			First(&wallet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrOrgWalletNotFound
			}
			return err
		}
		if wallet.Balance < amount {
			return ErrInsufficientOrgWalletBalance
		}
		now := common.GetTimestamp()
		if err := tx.Model(&OrganizationWallet{}).
			Where("id = ? AND balance >= ?", wallet.Id, amount).
			Updates(map[string]interface{}{
				"balance":    gorm.Expr("balance - ?", amount),
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		wallet.Balance -= amount
		wallet.UpdatedAt = now
		out = &wallet
		return nil
	})
	return out, err
}

// ReturnOrgWalletToWorkspace zeroes the wallet and returns prior balance (leave workspace).
func ReturnOrgWalletToWorkspace(userId, workspaceId int) (returned int, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		var wallet OrganizationWallet
		if err := lockForUpdate(tx).
			Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
			First(&wallet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				returned = 0
				return nil
			}
			return err
		}
		returned = wallet.Balance
		now := common.GetTimestamp()
		return tx.Model(&OrganizationWallet{}).
			Where("id = ?", wallet.Id).
			Updates(map[string]interface{}{
				"balance":    0,
				"updated_at": now,
			}).Error
	})
	return returned, err
}

// GetOrgWalletBalance returns the member's org-wallet balance for a workspace (0 if none).
func GetOrgWalletBalance(userId, workspaceId int) (int, error) {
	if userId <= 0 || workspaceId <= 0 {
		return 0, nil
	}
	var wallet OrganizationWallet
	err := DB.Select("balance").
		Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
		First(&wallet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return wallet.Balance, nil
}

// DecreaseOrgWalletBalance conditionally deducts amount when balance is sufficient.
func DecreaseOrgWalletBalance(userId, workspaceId, amount int) error {
	if amount <= 0 {
		return nil
	}
	if userId <= 0 || workspaceId <= 0 {
		return ErrOrgWalletNotFound
	}
	now := common.GetTimestamp()
	result := DB.Model(&OrganizationWallet{}).
		Where("user_id = ? AND workspace_id = ? AND balance >= ?", userId, workspaceId, amount).
		Updates(map[string]interface{}{
			"balance":    gorm.Expr("balance - ?", amount),
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrInsufficientOrgWalletBalance
	}
	return nil
}

// DecreaseOrgWalletBalanceForce deducts amount even if it would go negative (settle overflow).
func DecreaseOrgWalletBalanceForce(userId, workspaceId, amount int) error {
	if amount <= 0 {
		return nil
	}
	if userId <= 0 || workspaceId <= 0 {
		return ErrOrgWalletNotFound
	}
	now := common.GetTimestamp()
	result := DB.Model(&OrganizationWallet{}).
		Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
		Updates(map[string]interface{}{
			"balance":    gorm.Expr("balance - ?", amount),
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrOrgWalletNotFound
	}
	return nil
}

// IncreaseOrgWalletBalance refunds amount into the member org wallet.
func IncreaseOrgWalletBalance(userId, workspaceId, amount int) error {
	if amount <= 0 {
		return nil
	}
	if userId <= 0 || workspaceId <= 0 {
		return ErrOrgWalletNotFound
	}
	now := common.GetTimestamp()
	result := DB.Model(&OrganizationWallet{}).
		Where("user_id = ? AND workspace_id = ?", userId, workspaceId).
		Updates(map[string]interface{}{
			"balance":    gorm.Expr("balance + ?", amount),
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrOrgWalletNotFound
	}
	return nil
}
