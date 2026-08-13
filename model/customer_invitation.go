package model

// CustomerInvitation is an invite token to join a customer (and optional workspace).
type CustomerInvitation struct {
	Id            int    `json:"id"`
	CustomerId    int    `json:"customer_id" gorm:"not null;index"`
	WorkspaceId   *int   `json:"workspace_id,omitempty" gorm:"index"` // nil => join default workspace on accept
	Email         string `json:"email" gorm:"type:varchar(255);index"`
	Token         string `json:"token" gorm:"type:varchar(64);uniqueIndex;not null"`
	Role          string `json:"role" gorm:"type:varchar(32);not null"`           // customer role
	WorkspaceRole string `json:"workspace_role" gorm:"type:varchar(32);not null"` // workspace role
	InvitedBy     int    `json:"invited_by" gorm:"index"`
	Status        string `json:"status" gorm:"type:varchar(32);not null;default:pending;index"`
	ExpiresAt     int64  `json:"expires_at" gorm:"bigint"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

func (CustomerInvitation) TableName() string {
	return "customer_invitations"
}
