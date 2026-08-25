package model

import (
	"errors"

	"gorm.io/gorm"
)

const (
	MemberStatusEnabled  = 1
	MemberStatusDisabled = 0
)

// CustomerMember links a user to a customer with a role.
type CustomerMember struct {
	Id         int    `json:"id"`
	CustomerId int    `json:"customer_id" gorm:"not null;uniqueIndex:uk_customer_member;index"`
	UserId     int    `json:"user_id" gorm:"not null;uniqueIndex:uk_customer_member;index"`
	Role       string `json:"role" gorm:"type:varchar(32);not null"`
	Status     int    `json:"status" gorm:"default:1"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}

func (CustomerMember) TableName() string {
	return "customer_members"
}

// IsCustomerAdminRole reports whether the customer role can administer the customer.
func IsCustomerAdminRole(role string) bool {
	return role == CustomerRoleOwner || role == CustomerRoleAdmin
}

// IsValidCustomerRole reports whether role is a known customer role.
func IsValidCustomerRole(role string) bool {
	return role == CustomerRoleOwner || role == CustomerRoleAdmin || role == CustomerRoleMember
}

// GetCustomerMember returns the active membership row for user in customer.
func GetCustomerMember(customerId, userId int) (*CustomerMember, error) {
	if customerId <= 0 || userId <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var member CustomerMember
	err := DB.Where("customer_id = ? AND user_id = ? AND status = ?", customerId, userId, MemberStatusEnabled).
		First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// GetUserCustomerRole returns the user's customer role and customer id.
// Personal mode (no customer) returns ("", 0, nil).
func GetUserCustomerRole(userId int) (role string, customerId int, err error) {
	if userId <= 0 {
		return "", 0, nil
	}
	var user User
	err = DB.Select("id", "customer_id").Where("id = ?", userId).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", 0, nil
		}
		return "", 0, err
	}
	if user.CustomerId <= 0 {
		return "", 0, nil
	}
	member, err := GetCustomerMember(user.CustomerId, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// User.CustomerId set but membership missing/disabled — treat as personal.
			return "", 0, nil
		}
		return "", 0, err
	}
	return member.Role, user.CustomerId, nil
}

// UserCustomerMembership is a compact membership row for multi-customer UX.
type UserCustomerMembership struct {
	CustomerId   int    `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	CustomerSlug string `json:"customer_slug"`
	Role         string `json:"role"`
	Status       int    `json:"status"`
}

// ListUserCustomerMemberships lists all enabled customer memberships for a user.
func ListUserCustomerMemberships(userId int) ([]UserCustomerMembership, error) {
	if userId <= 0 {
		return nil, nil
	}
	type row struct {
		CustomerId   int
		CustomerName string
		CustomerSlug string
		Role         string
		Status       int
	}
	var rows []row
	err := DB.Table("customer_members AS m").
		Select("m.customer_id, c.name AS customer_name, c.slug AS customer_slug, m.role, m.status").
		Joins("JOIN customers AS c ON c.id = m.customer_id").
		Where("m.user_id = ? AND m.status = ?", userId, MemberStatusEnabled).
		Order("m.id asc").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]UserCustomerMembership, 0, len(rows))
	for _, r := range rows {
		out = append(out, UserCustomerMembership{
			CustomerId:   r.CustomerId,
			CustomerName: r.CustomerName,
			CustomerSlug: r.CustomerSlug,
			Role:         r.Role,
			Status:       r.Status,
		})
	}
	return out, nil
}

// SetUserCurrentCustomer switches users.customer_id to a customer the user belongs to.
func SetUserCurrentCustomer(userId, customerId int) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	if customerId <= 0 {
		return DB.Model(&User{}).Where("id = ?", userId).Update("customer_id", 0).Error
	}
	if _, err := GetCustomerMember(customerId, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCustomerForbiddenMembership
		}
		return err
	}
	return DB.Model(&User{}).Where("id = ?", userId).Update("customer_id", customerId).Error
}

// ErrCustomerForbiddenMembership is returned when switching to a non-member customer.
var ErrCustomerForbiddenMembership = errors.New("not a member of this customer")
