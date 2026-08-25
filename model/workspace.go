package model

import "gorm.io/gorm"

// Workspace is a budget/token scope under a Customer.
type Workspace struct {
	Id         int    `json:"id"`
	CustomerId int    `json:"customer_id" gorm:"not null;uniqueIndex:uk_workspace_customer_slug;index"`
	Name       string `json:"name" gorm:"type:varchar(128);not null"`
	Slug       string `json:"slug" gorm:"type:varchar(64);not null;uniqueIndex:uk_workspace_customer_slug"`
	Status     int    `json:"status" gorm:"default:1"`
	Quota      int    `json:"quota" gorm:"bigint;default:0"` // legacy workspace pool
	QuotaLimit int    `json:"quota_limit" gorm:"bigint;default:0;column:quota_limit"`
	UsedQuota  int    `json:"used_quota" gorm:"bigint;default:0;column:used_quota"`
	IsDefault  bool   `json:"is_default" gorm:"default:false"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
	// OccupiedQuota / AllocatableQuota are computed for API responses (not persisted).
	OccupiedQuota    int `json:"occupied_quota" gorm:"-"`
	AllocatableQuota int `json:"allocatable_quota" gorm:"-"`
}

func (Workspace) TableName() string {
	return "workspaces"
}

const WorkspaceSlugDefault = "default"

// GetWorkspaceById loads a workspace by primary key.
func GetWorkspaceById(id int) (*Workspace, error) {
	if id <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var workspace Workspace
	err := DB.Where("id = ?", id).First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}
