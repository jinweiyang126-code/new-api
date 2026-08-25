package model

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrWorkspaceNotFound             = errors.New("workspace not found")
	ErrWorkspaceSlugDuplicated       = errors.New("workspace slug already exists in this customer")
	ErrWorkspaceDisabled             = errors.New("workspace is disabled")
	ErrInsufficientCustomerQuota     = errors.New("insufficient customer quota")
	ErrInvalidTransferQuotaAmount    = errors.New("transfer amount must be positive")
	ErrCannotDisableDefaultWorkspace = errors.New("cannot disable the default workspace")
	ErrWorkspaceNameRequired         = errors.New("workspace name is required")
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

// NormalizeWorkspaceSlug turns a display name / raw slug into a safe workspace slug.
// Empty input yields empty string (caller may auto-generate).
func NormalizeWorkspaceSlug(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if r == '-' || r == '_' || unicode.IsSpace(r) {
			b.WriteByte('-')
		}
	}
	s = nonSlugChars.ReplaceAllString(b.String(), "-")
	s = strings.Trim(s, "-")
	if len(s) > 48 {
		s = strings.Trim(s[:48], "-")
	}
	return s
}

func allocateWorkspaceSlug(tx *gorm.DB, customerId int, preferred string) (string, error) {
	base := NormalizeWorkspaceSlug(preferred)
	if base == "" || base == WorkspaceSlugDefault {
		base = "ws-" + common.GetRandomString(8)
	}
	candidates := []string{base}
	for i := 0; i < 5; i++ {
		candidates = append(candidates, fmt.Sprintf("%s-%s", base, common.GetRandomString(4)))
	}
	for _, slug := range candidates {
		if slug == WorkspaceSlugDefault {
			continue
		}
		var count int64
		if err := tx.Model(&Workspace{}).
			Where("customer_id = ? AND slug = ?", customerId, slug).
			Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return slug, nil
		}
	}
	return "", ErrWorkspaceSlugDuplicated
}

// CreateWorkspace creates a workspace under customerId and optionally adds creator as workspace admin.
// Empty slug is auto-generated from name (same pattern as optional customer slug).
func CreateWorkspace(customerId int, name, slug string, creatorUserId int) (*Workspace, error) {
	if customerId <= 0 {
		return nil, ErrCustomerNotFound
	}
	name = strings.TrimSpace(name)
	slug = strings.TrimSpace(slug)
	if name == "" {
		return nil, ErrWorkspaceNameRequired
	}
	if NormalizeWorkspaceSlug(slug) == WorkspaceSlugDefault {
		return nil, errors.New("slug 'default' is reserved")
	}

	var workspace *Workspace
	err := DB.Transaction(func(tx *gorm.DB) error {
		var customer Customer
		if err := lockForUpdate(tx).Where("id = ?", customerId).First(&customer).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		if customer.Status != CustomerStatusEnabled {
			return errors.New("customer is disabled")
		}

		preferred := slug
		if preferred == "" {
			preferred = name
		}
		finalSlug, err := allocateWorkspaceSlug(tx, customerId, preferred)
		if err != nil {
			return err
		}

		now := common.GetTimestamp()
		ws := &Workspace{
			CustomerId: customerId,
			Name:       name,
			Slug:       finalSlug,
			Status:     CustomerStatusEnabled,
			Quota:      0,
			UsedQuota:  0,
			IsDefault:  false,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := tx.Create(ws).Error; err != nil {
			return err
		}
		workspace = ws

		if creatorUserId > 0 {
			if err := tx.Create(&WorkspaceMember{
				WorkspaceId: ws.Id,
				UserId:      creatorUserId,
				Role:        WorkspaceRoleAdmin,
				Status:      MemberStatusEnabled,
				CreatedAt:   now,
				UpdatedAt:   now,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return workspace, nil
}

// UpdateWorkspaceFields updates name, status and/or quota_limit.
func UpdateWorkspaceFields(id int, name *string, status *int, quotaLimit *int) (*Workspace, error) {
	if quotaLimit != nil {
		if _, err := SetWorkspaceQuotaLimit(id, *quotaLimit); err != nil {
			return nil, err
		}
		if name == nil && status == nil {
			return GetWorkspaceById(id)
		}
	}
	ws, err := GetWorkspaceById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}
	updates := map[string]interface{}{
		"updated_at": common.GetTimestamp(),
	}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return nil, errors.New("workspace name cannot be empty")
		}
		updates["name"] = trimmed
	}
	if status != nil {
		if *status != CustomerStatusEnabled && *status != CustomerStatusDisabled {
			return nil, errors.New("invalid workspace status")
		}
		if ws.IsDefault && *status == CustomerStatusDisabled {
			return nil, ErrCannotDisableDefaultWorkspace
		}
		updates["status"] = *status
	}
	if err := DB.Model(ws).Updates(updates).Error; err != nil {
		return nil, err
	}
	ws, err = GetWorkspaceById(id)
	if err != nil {
		return nil, err
	}
	_ = AttachWorkspaceQuotaLimitView(ws)
	return ws, nil
}

// TransferQuotaToWorkspace moves amount from customer pool to workspace pool.
// Uses row lock + conditional UPDATE (quota >= amount) to prevent concurrent oversell.
func TransferQuotaToWorkspace(workspaceId int, amount int) (customer *Customer, workspace *Workspace, err error) {
	if amount <= 0 {
		return nil, nil, ErrInvalidTransferQuotaAmount
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		var ws Workspace
		if err := lockForUpdate(tx).Where("id = ?", workspaceId).First(&ws).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWorkspaceNotFound
			}
			return err
		}
		if ws.Status != CustomerStatusEnabled {
			return ErrWorkspaceDisabled
		}

		var cust Customer
		if err := lockForUpdate(tx).Where("id = ?", ws.CustomerId).First(&cust).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomerNotFound
			}
			return err
		}
		if cust.Status != CustomerStatusEnabled {
			return errors.New("customer is disabled")
		}

		now := common.GetTimestamp()
		result := tx.Model(&Customer{}).
			Where("id = ? AND quota >= ?", cust.Id, amount).
			Updates(map[string]interface{}{
				"quota":      gorm.Expr("quota - ?", amount),
				"updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrInsufficientCustomerQuota
		}

		if err := tx.Model(&Workspace{}).
			Where("id = ?", ws.Id).
			Updates(map[string]interface{}{
				"quota":      gorm.Expr("quota + ?", amount),
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ?", cust.Id).First(&cust).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", ws.Id).First(&ws).Error; err != nil {
			return err
		}
		customer = &cust
		workspace = &ws
		return nil
	})
	return customer, workspace, err
}
