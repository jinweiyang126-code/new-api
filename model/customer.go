package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	CustomerStatusEnabled  = 1
	CustomerStatusDisabled = 0

	UpstreamModeShared    = "shared"
	UpstreamModeDedicated = "dedicated"
	UpstreamModeByok      = "byok"
	UpstreamModeHybrid    = "hybrid"

	UpstreamSourceShared    = "shared"
	UpstreamSourceDedicated = "dedicated"
	UpstreamSourceByok      = "byok"

	CustomerRoleOwner  = "owner"
	CustomerRoleAdmin  = "admin"
	CustomerRoleMember = "member"

	WorkspaceRoleAdmin  = "admin"
	WorkspaceRoleMember = "member"

	InvitationStatusPending  = "pending"
	InvitationStatusAccepted = "accepted"
	InvitationStatusExpired  = "expired"
	InvitationStatusRevoked  = "revoked"
)

var (
	ErrOwnerAlreadyHasCustomer = errors.New("owner already belongs to a customer")
	ErrCustomerSlugDuplicated  = errors.New("customer slug already exists")
	ErrCustomerNotFound        = errors.New("customer not found")
	ErrInvalidTopupAmount      = errors.New("topup amount must be positive")
)

// Customer is the billing/tenant unit (签约组织).
type Customer struct {
	Id                  int    `json:"id"`
	Name                string `json:"name" gorm:"type:varchar(128);not null"`
	Slug                string `json:"slug" gorm:"type:varchar(64);uniqueIndex"`
	Status              int    `json:"status" gorm:"default:1"`
	Quota               int    `json:"quota" gorm:"bigint;default:0"` // legacy pool; billing may still reference until org-wallet cutover
	QuotaLimit          int    `json:"quota_limit" gorm:"bigint;default:0;column:quota_limit"`
	UsedQuota           int    `json:"used_quota" gorm:"bigint;default:0;column:used_quota"`
	// OccupiedQuota / AllocatableQuota are computed for API responses (not persisted).
	OccupiedQuota    int `json:"occupied_quota" gorm:"-"`
	AllocatableQuota int `json:"allocatable_quota" gorm:"-"`
	OwnerUserId         int    `json:"owner_user_id" gorm:"index;column:owner_user_id"`
	Remark              string `json:"remark" gorm:"type:varchar(255)"`
	UpstreamMode        string `json:"upstream_mode" gorm:"type:varchar(32);not null;default:shared"`
	AllowGlobalFallback bool   `json:"allow_global_fallback" gorm:"not null;default:true"`
	ByokEnabled         bool   `json:"byok_enabled" gorm:"not null;default:false"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt           int64  `json:"updated_at" gorm:"bigint"`
}

// CustomerView is a list/detail row with owner username for display.
type CustomerView struct {
	Customer
	OwnerUsername string `json:"owner_username"`
}

func (Customer) TableName() string {
	return "customers"
}

// DefaultUpstreamMode returns shared when empty.
func (c *Customer) DefaultUpstreamMode() string {
	if c == nil || c.UpstreamMode == "" {
		return UpstreamModeShared
	}
	return c.UpstreamMode
}

// GetCustomerById loads a customer by primary key.
func GetCustomerById(id int) (*Customer, error) {
	if id <= 0 {
		return nil, ErrCustomerNotFound
	}
	var customer Customer
	err := DB.Where("id = ?", id).First(&customer).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCustomerNotFound
		}
		return nil, err
	}
	return &customer, nil
}

// GetAllCustomers returns a paginated customer list (platform root).
// keyword matches name/slug/remark (case-insensitive). status < 0 means all.
func GetAllCustomers(startIdx, pageSize int, keyword string, status int, sortBy, sortOrder string) (customers []*CustomerView, total int64, err error) {
	tx := DB.Model(&Customer{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("name LIKE ? OR slug LIKE ? OR remark LIKE ?", like, like, like)
	}
	if status == CustomerStatusEnabled || status == CustomerStatusDisabled {
		tx = tx.Where("status = ?", status)
	}
	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	orderClause := customerListOrder(sortBy, sortOrder)
	var rows []*Customer
	err = tx.Order(orderClause).Limit(pageSize).Offset(startIdx).Find(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	views, err := AttachCustomerOwnerUsernames(rows)
	if err != nil {
		return nil, 0, err
	}
	if err := OverlayCustomerViewUsedQuota(views); err != nil {
		return nil, 0, err
	}
	for _, v := range views {
		_ = AttachCustomerQuotaLimitView(&v.Customer)
	}
	return views, total, nil
}

func customerListOrder(sortBy, sortOrder string) string {
	col := "id"
	switch strings.TrimSpace(sortBy) {
	case "id", "name", "quota", "quota_limit", "status", "created_at", "upstream_mode", "owner_user_id", "used_quota":
		col = sortBy
	case "owner_username":
		col = "owner_user_id"
	}
	dir := "desc"
	if strings.EqualFold(strings.TrimSpace(sortOrder), "asc") {
		dir = "asc"
	}
	return col + " " + dir
}

// AttachCustomerOwnerUsernames fills owner_username for display.
func AttachCustomerOwnerUsernames(customers []*Customer) ([]*CustomerView, error) {
	out := make([]*CustomerView, 0, len(customers))
	if len(customers) == 0 {
		return out, nil
	}
	ids := make([]int, 0, len(customers))
	for _, c := range customers {
		if c == nil {
			continue
		}
		ids = append(ids, c.OwnerUserId)
	}
	nameByID, err := usernamesByIDs(ids)
	if err != nil {
		return nil, err
	}
	for _, c := range customers {
		if c == nil {
			continue
		}
		out = append(out, &CustomerView{
			Customer:      *c,
			OwnerUsername: nameByID[c.OwnerUserId],
		})
	}
	return out, nil
}

// GetCustomerViewById loads a customer with owner username.
func GetCustomerViewById(id int) (*CustomerView, error) {
	customer, err := GetCustomerById(id)
	if err != nil {
		return nil, err
	}
	views, err := AttachCustomerOwnerUsernames([]*Customer{customer})
	if err != nil {
		return nil, err
	}
	if len(views) == 0 {
		return nil, ErrCustomerNotFound
	}
	if err := OverlayCustomerViewUsedQuota(views); err != nil {
		return nil, err
	}
	_ = AttachCustomerQuotaLimitView(&views[0].Customer)
	return views[0], nil
}

// GetWorkspacesByCustomerId lists workspaces under a customer.
func GetWorkspacesByCustomerId(customerId int) ([]*Workspace, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	var workspaces []*Workspace
	err := DB.Where("customer_id = ?", customerId).Order("is_default desc, id asc").Find(&workspaces).Error
	if err != nil {
		return nil, err
	}
	_ = AttachWorkspaceQuotaLimitViews(workspaces)
	return workspaces, nil
}

// CreateCustomerWithOwner creates customer + default workspace + owner membership
// and sets users.customer_id to the new customer (current context).
// P3: owner may already belong to other customers (multi-customer).
func CreateCustomerWithOwner(customer *Customer, ownerUserId int) (*Workspace, error) {
	if customer == nil {
		return nil, errors.New("customer is nil")
	}
	if ownerUserId <= 0 {
		return nil, errors.New("owner_user_id is required")
	}
	name := strings.TrimSpace(customer.Name)
	if name == "" {
		return nil, errors.New("customer name is required")
	}
	customer.Name = name
	customer.Slug = strings.TrimSpace(customer.Slug)
	customer.Remark = strings.TrimSpace(customer.Remark)

	var defaultWorkspace *Workspace
	err := DB.Transaction(func(tx *gorm.DB) error {
		var owner User
		if err := lockForUpdate(tx).
			Select("id", "customer_id", "status").
			Where("id = ?", ownerUserId).First(&owner).Error; err != nil {
			return err
		}
		if owner.Status != common.UserStatusEnabled {
			return errors.New("owner user is disabled")
		}

		if customer.Slug != "" {
			var count int64
			if err := tx.Model(&Customer{}).Where("slug = ?", customer.Slug).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return ErrCustomerSlugDuplicated
			}
		} else {
			customer.Slug = fmt.Sprintf("c-%s", common.GetRandomString(10))
		}

		now := common.GetTimestamp()
		customer.OwnerUserId = ownerUserId
		customer.Status = CustomerStatusEnabled
		customer.Quota = 0
		customer.UsedQuota = 0
		if customer.UpstreamMode == "" {
			customer.UpstreamMode = UpstreamModeShared
		}
		customer.AllowGlobalFallback = true
		customer.ByokEnabled = false
		customer.CreatedAt = now
		customer.UpdatedAt = now

		if err := tx.Create(customer).Error; err != nil {
			return err
		}

		ws := &Workspace{
			CustomerId: customer.Id,
			Name:       WorkspaceSlugDefault,
			Slug:       WorkspaceSlugDefault,
			Status:     CustomerStatusEnabled,
			Quota:      0,
			UsedQuota:  0,
			IsDefault:  true,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := tx.Create(ws).Error; err != nil {
			return err
		}
		defaultWorkspace = ws

		if err := tx.Create(&CustomerMember{
			CustomerId: customer.Id,
			UserId:     ownerUserId,
			Role:       CustomerRoleOwner,
			Status:     MemberStatusEnabled,
			CreatedAt:  now,
			UpdatedAt:  now,
		}).Error; err != nil {
			return err
		}

		if err := tx.Create(&WorkspaceMember{
			WorkspaceId: ws.Id,
			UserId:      ownerUserId,
			Role:        WorkspaceRoleAdmin,
			Status:      MemberStatusEnabled,
			CreatedAt:   now,
			UpdatedAt:   now,
		}).Error; err != nil {
			return err
		}

		result := tx.Model(&User{}).
			Where("id = ?", ownerUserId).
			Update("customer_id", customer.Id)
		if result.Error != nil {
			return result.Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return defaultWorkspace, nil
}

// UpdateCustomerFields updates name/remark/status. Caller enforces which fields are allowed.
func UpdateCustomerFields(id int, name *string, remark *string, status *int) (*Customer, error) {
	customer, err := GetCustomerById(id)
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{
		"updated_at": common.GetTimestamp(),
	}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return nil, errors.New("customer name cannot be empty")
		}
		updates["name"] = trimmed
	}
	if remark != nil {
		updates["remark"] = strings.TrimSpace(*remark)
	}
	if status != nil {
		if *status != CustomerStatusEnabled && *status != CustomerStatusDisabled {
			return nil, errors.New("invalid customer status")
		}
		updates["status"] = *status
	}
	if err := DB.Model(customer).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetCustomerById(id)
}

// TopUpCustomerQuota increases customers.quota by amount (>0).
func TopUpCustomerQuota(customerId int, amount int) (*Customer, error) {
	if amount <= 0 {
		return nil, ErrInvalidTopupAmount
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var customer Customer
		if err := lockForUpdate(tx).
			Where("id = ?", customerId).First(&customer).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		return tx.Model(&Customer{}).
			Where("id = ?", customerId).
			Updates(map[string]interface{}{
				"quota":      gorm.Expr("quota + ?", amount),
				"updated_at": common.GetTimestamp(),
			}).Error
	})
	if err != nil {
		return nil, err
	}
	return GetCustomerById(customerId)
}
