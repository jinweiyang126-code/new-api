package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUpstreamOpsDB(t *testing.T) {
	t.Helper()
	prev := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Customer{}, &Channel{}, &CustomerChannelBinding{}))
	DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() { DB = prev })
}

func TestUpdateCustomerUpstreamSettingsAndBindings(t *testing.T) {
	setupUpstreamOpsDB(t)
	c := &Customer{
		Name: "Up", Slug: "up-1", Status: CustomerStatusEnabled,
		UpstreamMode: UpstreamModeShared, AllowGlobalFallback: true,
	}
	require.NoError(t, DB.Create(c).Error)
	require.NoError(t, DB.Create(&Channel{Id: 9, Name: "ch", Key: "k", Status: common.ChannelStatusEnabled}).Error)

	fallback := false
	byok := true
	updated, err := UpdateCustomerUpstreamSettings(c.Id, UpstreamModeDedicated, &fallback, &byok)
	require.NoError(t, err)
	require.Equal(t, UpstreamModeDedicated, updated.UpstreamMode)
	require.False(t, updated.AllowGlobalFallback)
	require.True(t, updated.ByokEnabled)

	binding, err := CreateCustomerChannelBinding(c.Id, 9, 10, "")
	require.NoError(t, err)
	require.Equal(t, 9, binding.ChannelId)

	list, err := ListCustomerChannelBindings(c.Id)
	require.NoError(t, err)
	require.Len(t, list, 1)

	require.NoError(t, DeleteCustomerChannelBinding(c.Id, binding.Id))
	list, err = ListCustomerChannelBindings(c.Id)
	require.NoError(t, err)
	require.Len(t, list, 0)
}
