/*
Copyright (C) 2023-2026 QuantumNous
*/
package model

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrUpstreamCredentialNotFound   = errors.New("upstream credential not found")
	ErrUpstreamCredentialInvalid    = errors.New("invalid upstream credential")
	ErrByokNotEnabled               = errors.New("byok is not enabled for this customer")
	ErrUpstreamCredentialKeyRequired = errors.New("upstream key is required")
)

// UpstreamCredentialDTO is the API-safe credential view (never includes ciphertext).
type UpstreamCredentialDTO struct {
	Id         int    `json:"id"`
	CustomerId int    `json:"customer_id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	BaseURL    string `json:"base_url"`
	KeyHint    string `json:"key_hint"`
	Models     string `json:"models"`
	Priority   int    `json:"priority"`
	Status     int    `json:"status"`
	CreatedBy  int    `json:"created_by"`
	RotatedAt  int64  `json:"rotated_at"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

func (c *CustomerUpstreamCredential) ToDTO() *UpstreamCredentialDTO {
	if c == nil {
		return nil
	}
	return &UpstreamCredentialDTO{
		Id:         c.Id,
		CustomerId: c.CustomerId,
		Name:       c.Name,
		Type:       c.Type,
		BaseURL:    c.BaseURL,
		KeyHint:    c.KeyHint,
		Models:     c.Models,
		Priority:   c.Priority,
		Status:     c.Status,
		CreatedBy:  c.CreatedBy,
		RotatedAt:  c.RotatedAt,
		CreatedAt:  c.CreatedAt,
		UpdatedAt:  c.UpdatedAt,
	}
}

// MarshalJSON ensures KeyCiphertext is never serialized even if tags are bypassed.
func (c CustomerUpstreamCredential) MarshalJSON() ([]byte, error) {
	return json.Marshal(c.ToDTO())
}

type CreateUpstreamCredentialInput struct {
	Name     string
	Type     string
	BaseURL  string
	Key      string
	Models   string
	Priority int
	Status   *int
}

type UpdateUpstreamCredentialInput struct {
	Name     *string
	Type     *string
	BaseURL  *string
	Key      *string // if set and non-empty, rotate
	Models   *string
	Priority *int
	Status   *int
}

func requireCustomerByokEnabled(customerId int) (*Customer, error) {
	customer, err := GetCustomerById(customerId)
	if err != nil {
		return nil, err
	}
	if !customer.ByokEnabled {
		return customer, ErrByokNotEnabled
	}
	return customer, nil
}

// ListCustomerUpstreamCredentials returns API-safe DTOs (hint only).
func ListCustomerUpstreamCredentials(customerId int) ([]*UpstreamCredentialDTO, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	if _, err := GetCustomerById(customerId); err != nil {
		return nil, err
	}
	var rows []*CustomerUpstreamCredential
	if err := DB.Where("customer_id = ?", customerId).
		Order("priority desc, id asc").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*UpstreamCredentialDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.ToDTO())
	}
	return out, nil
}

// GetCustomerUpstreamCredential loads one credential scoped to customer.
func GetCustomerUpstreamCredential(customerId, credentialId int) (*CustomerUpstreamCredential, error) {
	if customerId <= 0 || credentialId <= 0 {
		return nil, ErrUpstreamCredentialNotFound
	}
	var row CustomerUpstreamCredential
	err := DB.Where("id = ? AND customer_id = ?", credentialId, customerId).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUpstreamCredentialNotFound
		}
		return nil, err
	}
	return &row, nil
}

// CreateCustomerUpstreamCredential encrypts the key and stores the credential.
// Requires customer.byok_enabled.
func CreateCustomerUpstreamCredential(customerId, createdBy int, in CreateUpstreamCredentialInput) (*UpstreamCredentialDTO, error) {
	if _, err := requireCustomerByokEnabled(customerId); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	typ := strings.TrimSpace(in.Type)
	key := strings.TrimSpace(in.Key)
	if name == "" || typ == "" {
		return nil, ErrUpstreamCredentialInvalid
	}
	if key == "" {
		return nil, ErrUpstreamCredentialKeyRequired
	}
	ciphertext, err := common.EncryptSecretAESGCM(key)
	if err != nil {
		return nil, err
	}
	status := CustomerStatusEnabled
	if in.Status != nil {
		status = *in.Status
	}
	now := common.GetTimestamp()
	row := &CustomerUpstreamCredential{
		CustomerId:    customerId,
		Name:          name,
		Type:          typ,
		BaseURL:       strings.TrimSpace(in.BaseURL),
		KeyCiphertext: ciphertext,
		KeyHint:       common.SecretHint(key),
		Models:        strings.TrimSpace(in.Models),
		Priority:      in.Priority,
		Status:        status,
		CreatedBy:     createdBy,
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := DB.Create(row).Error; err != nil {
		return nil, err
	}
	return row.ToDTO(), nil
}

// UpdateCustomerUpstreamCredential updates metadata and optionally rotates the key.
// Requires customer.byok_enabled for key rotation / metadata edits.
func UpdateCustomerUpstreamCredential(customerId, credentialId int, in UpdateUpstreamCredentialInput) (*UpstreamCredentialDTO, error) {
	if _, err := requireCustomerByokEnabled(customerId); err != nil {
		return nil, err
	}
	row, err := GetCustomerUpstreamCredential(customerId, credentialId)
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{
		"updated_at": common.GetTimestamp(),
	}
	if in.Name != nil {
		name := strings.TrimSpace(*in.Name)
		if name == "" {
			return nil, ErrUpstreamCredentialInvalid
		}
		updates["name"] = name
	}
	if in.Type != nil {
		typ := strings.TrimSpace(*in.Type)
		if typ == "" {
			return nil, ErrUpstreamCredentialInvalid
		}
		updates["type"] = typ
	}
	if in.BaseURL != nil {
		updates["base_url"] = strings.TrimSpace(*in.BaseURL)
	}
	if in.Models != nil {
		updates["models"] = strings.TrimSpace(*in.Models)
	}
	if in.Priority != nil {
		updates["priority"] = *in.Priority
	}
	if in.Status != nil {
		updates["status"] = *in.Status
	}
	if in.Key != nil {
		key := strings.TrimSpace(*in.Key)
		if key == "" {
			return nil, ErrUpstreamCredentialKeyRequired
		}
		ciphertext, err := common.EncryptSecretAESGCM(key)
		if err != nil {
			return nil, err
		}
		updates["key_ciphertext"] = ciphertext
		updates["key_hint"] = common.SecretHint(key)
		updates["rotated_at"] = common.GetTimestamp()
	}
	if err := DB.Model(row).Updates(updates).Error; err != nil {
		return nil, err
	}
	updated, err := GetCustomerUpstreamCredential(customerId, credentialId)
	if err != nil {
		return nil, err
	}
	return updated.ToDTO(), nil
}

// DeleteCustomerUpstreamCredential removes a credential (allowed even if BYOK disabled, for cleanup).
func DeleteCustomerUpstreamCredential(customerId, credentialId int) error {
	if customerId <= 0 || credentialId <= 0 {
		return ErrUpstreamCredentialNotFound
	}
	if _, err := GetCustomerById(customerId); err != nil {
		return err
	}
	result := DB.Where("id = ? AND customer_id = ?", credentialId, customerId).
		Delete(&CustomerUpstreamCredential{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUpstreamCredentialNotFound
	}
	return nil
}

// DecryptCustomerUpstreamCredentialKey decrypts the stored key for relay use (T15).
// Caller must not log or return the plaintext.
func DecryptCustomerUpstreamCredentialKey(customerId, credentialId int) (string, error) {
	row, err := GetCustomerUpstreamCredential(customerId, credentialId)
	if err != nil {
		return "", err
	}
	return common.DecryptSecretAESGCM(row.KeyCiphertext)
}

// ListEnabledUpstreamCredentialsForRelay returns enabled credentials with ciphertext
// for in-memory decrypt during channel selection (T15). Do not expose via HTTP.
func ListEnabledUpstreamCredentialsForRelay(customerId int) ([]*CustomerUpstreamCredential, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	var rows []*CustomerUpstreamCredential
	err := DB.Where("customer_id = ? AND status = ?", customerId, CustomerStatusEnabled).
		Order("priority desc, id asc").
		Find(&rows).Error
	return rows, err
}

// TestCustomerUpstreamCredential verifies the stored key can be decrypted.
// Live upstream connectivity probing is deferred to T15 / optional ops.
func TestCustomerUpstreamCredential(customerId, credentialId int) error {
	customer, err := requireCustomerByokEnabled(customerId)
	if err != nil {
		return err
	}
	_ = customer
	row, err := GetCustomerUpstreamCredential(customerId, credentialId)
	if err != nil {
		return err
	}
	if row.Status != CustomerStatusEnabled {
		return ErrUpstreamCredentialInvalid
	}
	plain, err := common.DecryptSecretAESGCM(row.KeyCiphertext)
	if err != nil {
		return err
	}
	if strings.TrimSpace(plain) == "" {
		return ErrUpstreamCredentialInvalid
	}
	return nil
}
