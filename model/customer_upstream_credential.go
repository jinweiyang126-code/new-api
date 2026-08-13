package model

// CustomerUpstreamCredential stores encrypted BYOK upstream keys for a customer.
// Never expose KeyCiphertext via API responses.
type CustomerUpstreamCredential struct {
	Id            int    `json:"id"`
	CustomerId    int    `json:"customer_id" gorm:"not null;index"`
	Name          string `json:"name" gorm:"type:varchar(128);not null"`
	Type          string `json:"type" gorm:"type:varchar(64);not null"` // align with channel types
	BaseURL       string `json:"base_url" gorm:"type:varchar(512);column:base_url"`
	KeyCiphertext string `json:"-" gorm:"type:text;not null;column:key_ciphertext"`
	KeyHint       string `json:"key_hint" gorm:"type:varchar(16);column:key_hint"`
	Models        string `json:"models" gorm:"type:text"` // optional JSON allowlist
	Priority      int    `json:"priority" gorm:"default:0"`
	Status        int    `json:"status" gorm:"default:1"`
	CreatedBy     int    `json:"created_by" gorm:"index;column:created_by"`
	RotatedAt     int64  `json:"rotated_at" gorm:"bigint;column:rotated_at"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

func (CustomerUpstreamCredential) TableName() string {
	return "customer_upstream_credentials"
}
