package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrInvalidUpstreamMode     = errors.New("invalid upstream mode")
	ErrChannelBindingNotFound  = errors.New("channel binding not found")
	ErrChannelBindingDuplicate = errors.New("channel already bound to customer")
	ErrInvalidChannelId        = errors.New("invalid channel id")
)

// UpdateCustomerUpstreamSettings updates mode / fallback / byok (root only; caller enforces).
func UpdateCustomerUpstreamSettings(id int, mode string, allowFallback *bool, byokEnabled *bool) (*Customer, error) {
	customer, err := GetCustomerById(id)
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{
		"updated_at": common.GetTimestamp(),
	}
	if mode != "" {
		mode = strings.TrimSpace(mode)
		switch mode {
		case UpstreamModeShared, UpstreamModeDedicated, UpstreamModeByok, UpstreamModeHybrid:
			updates["upstream_mode"] = mode
		default:
			return nil, ErrInvalidUpstreamMode
		}
	}
	if allowFallback != nil {
		updates["allow_global_fallback"] = *allowFallback
	}
	if byokEnabled != nil {
		updates["byok_enabled"] = *byokEnabled
	}
	if len(updates) == 1 {
		return customer, nil
	}
	if err := DB.Model(customer).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetCustomerById(id)
}

// ListCustomerChannelBindings returns bindings for a customer.
func ListCustomerChannelBindings(customerId int) ([]*CustomerChannelBinding, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	var rows []*CustomerChannelBinding
	err := DB.Where("customer_id = ?", customerId).Order("priority desc, id asc").Find(&rows).Error
	return rows, err
}

// CreateCustomerChannelBinding binds a platform channel to a customer.
func CreateCustomerChannelBinding(customerId, channelId, priority int, modelMapping string) (*CustomerChannelBinding, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	if channelId <= 0 {
		return nil, ErrInvalidChannelId
	}
	if _, err := GetCustomerById(customerId); err != nil {
		return nil, err
	}
	var ch Channel
	if err := DB.Select("id").Where("id = ?", channelId).First(&ch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidChannelId
		}
		return nil, err
	}
	now := common.GetTimestamp()
	row := &CustomerChannelBinding{
		CustomerId:   customerId,
		ChannelId:    channelId,
		Priority:     priority,
		ModelMapping: modelMapping,
		Status:       CustomerStatusEnabled,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	err := DB.Create(row).Error
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(err.Error(), "Duplicate") {
			return nil, ErrChannelBindingDuplicate
		}
		return nil, err
	}
	return row, nil
}

// DeleteCustomerChannelBinding removes a binding by id scoped to customer.
func DeleteCustomerChannelBinding(customerId, bindingId int) error {
	if customerId <= 0 || bindingId <= 0 {
		return ErrChannelBindingNotFound
	}
	result := DB.Where("id = ? AND customer_id = ?", bindingId, customerId).Delete(&CustomerChannelBinding{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelBindingNotFound
	}
	return nil
}
