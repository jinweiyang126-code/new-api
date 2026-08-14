package model

// CustomerChannelBinding binds a platform channel to a customer (dedicated upstream).
type CustomerChannelBinding struct {
	Id           int    `json:"id"`
	CustomerId   int    `json:"customer_id" gorm:"not null;uniqueIndex:uk_customer_channel;index"`
	ChannelId    int    `json:"channel_id" gorm:"not null;uniqueIndex:uk_customer_channel;index"`
	Priority     int    `json:"priority" gorm:"default:0"`
	ModelMapping string `json:"model_mapping" gorm:"type:text"` // optional JSON
	Status       int    `json:"status" gorm:"default:1"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
	ChannelName  string `json:"channel_name,omitempty" gorm:"-"`
}

func (CustomerChannelBinding) TableName() string {
	return "customer_channel_bindings"
}
