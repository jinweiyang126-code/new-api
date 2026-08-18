package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// GetWorkspaceQuota returns the remaining workspace pool balance.
func GetWorkspaceQuota(id int) (int, error) {
	if id <= 0 {
		return 0, ErrWorkspaceNotFound
	}
	var ws Workspace
	err := DB.Select("quota").Where("id = ?", id).First(&ws).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrWorkspaceNotFound
		}
		return 0, err
	}
	return ws.Quota, nil
}

// DecreaseWorkspaceQuota deducts amount from the workspace pool.
// Uses conditional UPDATE (quota >= amount) so concurrent consumes cannot oversell.
// Does not use batch update — M1 keeps workspace pool updates synchronous.
func DecreaseWorkspaceQuota(id int, amount int) error {
	if amount < 0 {
		return errors.New("quota 不能为负数！")
	}
	if amount == 0 {
		return nil
	}
	if id <= 0 {
		return ErrWorkspaceNotFound
	}
	result := DB.Model(&Workspace{}).
		Where("id = ? AND quota >= ?", id, amount).
		Updates(map[string]interface{}{
			"quota":      gorm.Expr("quota - ?", amount),
			"updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		q, _ := GetWorkspaceQuota(id)
		return fmt.Errorf("workspace quota insufficient, remain=%d need=%d", q, amount)
	}
	return nil
}

// DecreaseWorkspaceQuotaForce deducts without a balance floor (settle/reserve top-up;
// may leave a negative pool, matching wallet settle semantics).
func DecreaseWorkspaceQuotaForce(id int, amount int) error {
	if amount < 0 {
		return errors.New("quota 不能为负数！")
	}
	if amount == 0 {
		return nil
	}
	if id <= 0 {
		return ErrWorkspaceNotFound
	}
	return DB.Model(&Workspace{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"quota":      gorm.Expr("quota - ?", amount),
			"updated_at": common.GetTimestamp(),
		}).Error
}

// IncreaseWorkspaceQuota credits amount back to the workspace pool (refund / settle).
func IncreaseWorkspaceQuota(id int, amount int) error {
	if amount < 0 {
		return errors.New("quota 不能为负数！")
	}
	if amount == 0 {
		return nil
	}
	if id <= 0 {
		return ErrWorkspaceNotFound
	}
	return DB.Model(&Workspace{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"quota":      gorm.Expr("quota + ?", amount),
			"updated_at": common.GetTimestamp(),
		}).Error
}

// UpdateWorkspaceUsedQuota increments used_quota for stats (does not change balance).
func UpdateWorkspaceUsedQuota(id int, quota int) {
	if id <= 0 || quota == 0 {
		return
	}
	err := DB.Model(&Workspace{}).Where("id = ?", id).
		Update("used_quota", gorm.Expr("used_quota + ?", quota)).Error
	if err != nil {
		common.SysLog("failed to update workspace used quota: " + err.Error())
	}
}

// UpdateCustomerUsedQuota increments customers.used_quota for stats (does not change pool balance).
func UpdateCustomerUsedQuota(id int, quota int) {
	if id <= 0 || quota == 0 {
		return
	}
	err := DB.Model(&Customer{}).Where("id = ?", id).
		Update("used_quota", gorm.Expr("used_quota + ?", quota)).Error
	if err != nil {
		common.SysLog("failed to update customer used quota: " + err.Error())
	}
}

// SumWorkspaceUsedQuotaByCustomerIDs returns SUM(workspaces.used_quota) per customer.
func SumWorkspaceUsedQuotaByCustomerIDs(ids []int) (map[int]int, error) {
	out := make(map[int]int, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	type row struct {
		CustomerId int `gorm:"column:customer_id"`
		Used       int `gorm:"column:used"`
	}
	var rows []row
	err := DB.Model(&Workspace{}).
		Select("customer_id, COALESCE(SUM(used_quota), 0) as used").
		Where("customer_id IN ?", ids).
		Group("customer_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.CustomerId] = r.Used
	}
	return out, nil
}

// OverlayCustomerViewUsedQuota sets each view's UsedQuota from workspace totals so
// the customer list matches actual workspace consumption (legacy rows never wrote customers.used_quota).
func OverlayCustomerViewUsedQuota(views []*CustomerView) error {
	if len(views) == 0 {
		return nil
	}
	ids := make([]int, 0, len(views))
	for _, v := range views {
		if v != nil && v.Id > 0 {
			ids = append(ids, v.Id)
		}
	}
	sums, err := SumWorkspaceUsedQuotaByCustomerIDs(ids)
	if err != nil {
		return err
	}
	for _, v := range views {
		if v == nil {
			continue
		}
		if used, ok := sums[v.Id]; ok && used > v.UsedQuota {
			v.UsedQuota = used
		}
	}
	return nil
}

// ValidateWorkspaceTokenActive ensures customer and workspace exist and are enabled.
func ValidateWorkspaceTokenActive(customerId, workspaceId int) error {
	if workspaceId <= 0 {
		return nil
	}
	ws, err := GetWorkspaceById(workspaceId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrWorkspaceNotFound
		}
		return err
	}
	if ws.Status != CustomerStatusEnabled {
		return ErrWorkspaceDisabled
	}
	cid := customerId
	if cid <= 0 {
		cid = ws.CustomerId
	}
	customer, err := GetCustomerById(cid)
	if err != nil {
		return err
	}
	if customer.Status != CustomerStatusEnabled {
		return errors.New("customer is disabled")
	}
	if ws.CustomerId != customer.Id {
		return errors.New("token customer/workspace mismatch")
	}
	return nil
}
