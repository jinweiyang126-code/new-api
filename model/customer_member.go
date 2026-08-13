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
