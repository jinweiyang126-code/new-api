/*
Copyright (C) 2023-2026 QuantumNous
*/
package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncryptDecryptSecretAESGCMRoundTrip(t *testing.T) {
	prev := CryptoSecret
	CryptoSecret = "test-crypto-secret-for-t14"
	t.Cleanup(func() { CryptoSecret = prev })

	plain := "sk-test-abcdefghijklmnop"
	enc, err := EncryptSecretAESGCM(plain)
	require.NoError(t, err)
	require.NotEqual(t, plain, enc)

	got, err := DecryptSecretAESGCM(enc)
	require.NoError(t, err)
	require.Equal(t, plain, got)
	require.Equal(t, "mnop", SecretHint(plain))
}

func TestEncryptSecretAESGCMRejectsEmpty(t *testing.T) {
	_, err := EncryptSecretAESGCM("")
	require.ErrorIs(t, err, ErrSecretEmpty)
}
