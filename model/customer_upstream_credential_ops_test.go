/*
Copyright (C) 2023-2026 QuantumNous
*/
package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCredentialOpsDB(t *testing.T) {
	t.Helper()
	prev := DB
	prevSecret := common.CryptoSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Customer{}, &CustomerUpstreamCredential{}))
	DB = db
	common.CryptoSecret = "t14-test-crypto-secret"
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = prev
		common.CryptoSecret = prevSecret
	})
}

func TestUpstreamCredentialCRUDEncryptsAndHidesKey(t *testing.T) {
	setupCredentialOpsDB(t)
	c := &Customer{
		Name: "Cred", Slug: "cred-1", Status: CustomerStatusEnabled,
		UpstreamMode: UpstreamModeShared, AllowGlobalFallback: true, ByokEnabled: true,
	}
	require.NoError(t, DB.Create(c).Error)

	_, err := CreateCustomerUpstreamCredential(c.Id, 1, CreateUpstreamCredentialInput{
		Name: "azure", Type: "openai", Key: "sk-secret-key-9999", Priority: 5,
	})
	require.NoError(t, err)

	list, err := ListCustomerUpstreamCredentials(c.Id)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "9999", list[0].KeyHint)
	require.Equal(t, "azure", list[0].Name)

	raw, err := json.Marshal(list[0])
	require.NoError(t, err)
	require.NotContains(t, string(raw), "sk-secret")
	require.NotContains(t, strings.ToLower(string(raw)), "ciphertext")

	var stored CustomerUpstreamCredential
	require.NoError(t, DB.First(&stored, list[0].Id).Error)
	require.NotEmpty(t, stored.KeyCiphertext)
	require.NotEqual(t, "sk-secret-key-9999", stored.KeyCiphertext)
	require.NotContains(t, stored.KeyCiphertext, "sk-secret")

	plain, err := DecryptCustomerUpstreamCredentialKey(c.Id, list[0].Id)
	require.NoError(t, err)
	require.Equal(t, "sk-secret-key-9999", plain)

	newKey := "sk-rotated-abcd"
	updated, err := UpdateCustomerUpstreamCredential(c.Id, list[0].Id, UpdateUpstreamCredentialInput{
		Key: &newKey,
	})
	require.NoError(t, err)
	require.Equal(t, "abcd", updated.KeyHint)

	require.NoError(t, TestCustomerUpstreamCredential(c.Id, list[0].Id))
	require.NoError(t, DeleteCustomerUpstreamCredential(c.Id, list[0].Id))
	list, err = ListCustomerUpstreamCredentials(c.Id)
	require.NoError(t, err)
	require.Len(t, list, 0)
}

func TestCreateUpstreamCredentialRequiresByokEnabled(t *testing.T) {
	setupCredentialOpsDB(t)
	c := &Customer{
		Name: "NoByok", Slug: "cred-2", Status: CustomerStatusEnabled,
		UpstreamMode: UpstreamModeShared, ByokEnabled: false,
	}
	require.NoError(t, DB.Create(c).Error)
	_, err := CreateCustomerUpstreamCredential(c.Id, 1, CreateUpstreamCredentialInput{
		Name: "x", Type: "openai", Key: "sk-1",
	})
	require.ErrorIs(t, err, ErrByokNotEnabled)
}

func TestCustomerUpstreamCredentialJSONNeverIncludesCiphertext(t *testing.T) {
	row := CustomerUpstreamCredential{
		Id: 1, CustomerId: 2, Name: "n", Type: "openai",
		KeyCiphertext: "CIPHERTEXT_SHOULD_NOT_APPEAR", KeyHint: "1234",
	}
	b, err := json.Marshal(row)
	require.NoError(t, err)
	require.NotContains(t, string(b), "CIPHERTEXT")
	require.Contains(t, string(b), "1234")
}
