package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func openCustomerWorkspaceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	return db
}

func TestCustomerWorkspaceModelsAutoMigrate(t *testing.T) {
	db := openCustomerWorkspaceTestDB(t)

	err := db.AutoMigrate(
		&User{},
		&Token{},
		&Log{},
		&Customer{},
		&Workspace{},
		&CustomerMember{},
		&WorkspaceMember{},
		&CustomerInvitation{},
		&CustomerChannelBinding{},
		&CustomerUpstreamCredential{},
	)
	require.NoError(t, err)

	// Existing-style user row remains personal mode (customer_id default 0).
	user := &User{
		Username:    "personal_user",
		Password:    "password123",
		Role:        1,
		Status:      1,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	var loaded User
	require.NoError(t, db.First(&loaded, user.Id).Error)
	require.Equal(t, 0, loaded.CustomerId)

	customer := &Customer{
		Name:                "Acme",
		Slug:                "acme",
		Status:              CustomerStatusEnabled,
		OwnerUserId:         user.Id,
		UpstreamMode:        "", // rely on DB/default semantics via explicit set in app; empty here to test create path
		AllowGlobalFallback: true,
		ByokEnabled:         false,
	}
	// Application should set default; simulate T03 create behavior for migration smoke.
	if customer.UpstreamMode == "" {
		customer.UpstreamMode = UpstreamModeShared
	}
	require.NoError(t, db.Create(customer).Error)
	require.Equal(t, UpstreamModeShared, customer.UpstreamMode)

	var stored Customer
	require.NoError(t, db.First(&stored, customer.Id).Error)
	require.Equal(t, UpstreamModeShared, stored.UpstreamMode)
	require.True(t, stored.AllowGlobalFallback)
	require.False(t, stored.ByokEnabled)

	ws := &Workspace{
		CustomerId: customer.Id,
		Name:       "default",
		Slug:       WorkspaceSlugDefault,
		Status:     CustomerStatusEnabled,
		IsDefault:  true,
	}
	require.NoError(t, db.Create(ws).Error)

	dup := &Workspace{
		CustomerId: customer.Id,
		Name:       "default-2",
		Slug:       WorkspaceSlugDefault,
		Status:     CustomerStatusEnabled,
	}
	require.Error(t, db.Create(dup).Error, "same customer+slug must be unique")

	otherCustomer := &Customer{
		Name:                "Beta",
		Slug:                "beta",
		Status:              CustomerStatusEnabled,
		UpstreamMode:        UpstreamModeShared,
		AllowGlobalFallback: true,
	}
	require.NoError(t, db.Create(otherCustomer).Error)
	okOther := &Workspace{
		CustomerId: otherCustomer.Id,
		Name:       "default",
		Slug:       WorkspaceSlugDefault,
		Status:     CustomerStatusEnabled,
		IsDefault:  true,
	}
	require.NoError(t, db.Create(okOther).Error, "same slug allowed under different customer")

	binding := &CustomerChannelBinding{
		CustomerId: customer.Id,
		ChannelId:  1,
		Priority:   1,
		Status:     CustomerStatusEnabled,
	}
	require.NoError(t, db.Create(binding).Error)
	dupBinding := &CustomerChannelBinding{
		CustomerId: customer.Id,
		ChannelId:  1,
		Priority:   2,
		Status:     CustomerStatusEnabled,
	}
	require.Error(t, db.Create(dupBinding).Error, "customer+channel binding must be unique")
}

func TestClickHouseLogCreateTableIncludesCustomerWorkspaceColumns(t *testing.T) {
	sql := clickHouseLogCreateTableSQL(0)
	require.Contains(t, sql, "customer_id")
	require.Contains(t, sql, "workspace_id")
	require.Contains(t, sql, "upstream_source")
}
