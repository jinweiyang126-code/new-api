package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrInvalidQuotaLimit          = errors.New("quota limit must be non-negative")
	ErrQuotaLimitBelowOccupied    = errors.New("quota limit cannot be below occupied amount")
	ErrCustomerQuotaLimitExceeded = errors.New("workspace limits would exceed customer quota limit")
)

// SumWorkspaceQuotaLimits returns Σ workspace.quota_limit for a customer.
func SumWorkspaceQuotaLimits(customerId int) (int, error) {
	if customerId <= 0 {
		return 0, ErrCustomerNotFound
	}
	var sum int64
	err := DB.Model(&Workspace{}).
		Where("customer_id = ?", customerId).
		Select("COALESCE(SUM(quota_limit), 0)").
		Scan(&sum).Error
	return int(sum), err
}

// SumOrgWalletBalances returns Σ organization_wallets.balance for a workspace.
func SumOrgWalletBalances(workspaceId int) (int, error) {
	if workspaceId <= 0 {
		return 0, ErrWorkspaceNotFound
	}
	var sum int64
	err := DB.Model(&OrganizationWallet{}).
		Where("workspace_id = ?", workspaceId).
		Select("COALESCE(SUM(balance), 0)").
		Scan(&sum).Error
	return int(sum), err
}

// AttachCustomerQuotaLimitView fills occupied/allocatable on a customer.
func AttachCustomerQuotaLimitView(customer *Customer) error {
	if customer == nil {
		return nil
	}
	occupied, err := SumWorkspaceQuotaLimits(customer.Id)
	if err != nil {
		return err
	}
	customer.OccupiedQuota = occupied
	customer.AllocatableQuota = customer.QuotaLimit - occupied
	return nil
}

// AttachWorkspaceQuotaLimitView fills occupied/allocatable on a workspace.
func AttachWorkspaceQuotaLimitView(workspace *Workspace) error {
	if workspace == nil {
		return nil
	}
	occupied, err := SumOrgWalletBalances(workspace.Id)
	if err != nil {
		return err
	}
	workspace.OccupiedQuota = occupied
	workspace.AllocatableQuota = workspace.QuotaLimit - occupied
	return nil
}

// AttachWorkspaceQuotaLimitViews attaches views for a slice.
func AttachWorkspaceQuotaLimitViews(workspaces []*Workspace) error {
	for _, ws := range workspaces {
		if err := AttachWorkspaceQuotaLimitView(ws); err != nil {
			return err
		}
	}
	return nil
}

// SetCustomerQuotaLimit sets customer.quota_limit. New limit must be >= Σ workspace limits.
func SetCustomerQuotaLimit(customerId int, quotaLimit int) (*Customer, error) {
	if quotaLimit < 0 {
		return nil, ErrInvalidQuotaLimit
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var customer Customer
		if err := lockForUpdate(tx).Where("id = ?", customerId).First(&customer).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		var occupied int64
		if err := tx.Model(&Workspace{}).
			Where("customer_id = ?", customerId).
			Select("COALESCE(SUM(quota_limit), 0)").
			Scan(&occupied).Error; err != nil {
			return err
		}
		if int64(quotaLimit) < occupied {
			return fmt.Errorf("%w: minimum %d", ErrQuotaLimitBelowOccupied, occupied)
		}
		return tx.Model(&Customer{}).
			Where("id = ?", customerId).
			Updates(map[string]interface{}{
				"quota_limit": quotaLimit,
				"updated_at":  common.GetTimestamp(),
			}).Error
	})
	if err != nil {
		return nil, err
	}
	customer, err := GetCustomerById(customerId)
	if err != nil {
		return nil, err
	}
	_ = AttachCustomerQuotaLimitView(customer)
	return customer, nil
}

// SetWorkspaceQuotaLimit sets workspace.quota_limit.
// Must be >= org-wallet occupied and not push Σ workspace limits over customer.quota_limit.
func SetWorkspaceQuotaLimit(workspaceId int, quotaLimit int) (*Workspace, error) {
	if quotaLimit < 0 {
		return nil, ErrInvalidQuotaLimit
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var ws Workspace
		if err := lockForUpdate(tx).Where("id = ?", workspaceId).First(&ws).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWorkspaceNotFound
			}
			return err
		}
		var customer Customer
		if err := lockForUpdate(tx).Where("id = ?", ws.CustomerId).First(&customer).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		var walletOccupied int64
		if err := tx.Model(&OrganizationWallet{}).
			Where("workspace_id = ?", workspaceId).
			Select("COALESCE(SUM(balance), 0)").
			Scan(&walletOccupied).Error; err != nil {
			return err
		}
		if int64(quotaLimit) < walletOccupied {
			return fmt.Errorf("%w: minimum %d", ErrQuotaLimitBelowOccupied, walletOccupied)
		}
		var otherLimits int64
		if err := tx.Model(&Workspace{}).
			Where("customer_id = ? AND id <> ?", ws.CustomerId, workspaceId).
			Select("COALESCE(SUM(quota_limit), 0)").
			Scan(&otherLimits).Error; err != nil {
			return err
		}
		if customer.QuotaLimit > 0 && otherLimits+int64(quotaLimit) > int64(customer.QuotaLimit) {
			return ErrCustomerQuotaLimitExceeded
		}
		return tx.Model(&Workspace{}).
			Where("id = ?", workspaceId).
			Updates(map[string]interface{}{
				"quota_limit": quotaLimit,
				"updated_at":  common.GetTimestamp(),
			}).Error
	})
	if err != nil {
		return nil, err
	}
	ws, err := GetWorkspaceById(workspaceId)
	if err != nil {
		return nil, err
	}
	_ = AttachWorkspaceQuotaLimitView(ws)
	return ws, nil
}

// SyncLegacyQuotaLimitsOnce copies legacy pool quota into quota_limit when limit is still 0.
func SyncLegacyQuotaLimitsOnce() error {
	if err := DB.Exec(
		"UPDATE customers SET quota_limit = quota WHERE quota_limit = 0 AND quota > 0",
	).Error; err != nil {
		return err
	}
	return DB.Exec(
		"UPDATE workspaces SET quota_limit = quota WHERE quota_limit = 0 AND quota > 0",
	).Error
}
