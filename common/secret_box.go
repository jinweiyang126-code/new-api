/*
Copyright (C) 2023-2026 QuantumNous
*/
package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

var (
	ErrSecretEmpty      = errors.New("plaintext secret is empty")
	ErrCiphertextEmpty  = errors.New("ciphertext is empty")
	ErrCiphertextInvalid = errors.New("ciphertext is invalid")
)

// EncryptSecretAESGCM encrypts plaintext with AES-256-GCM using a key derived
// from CryptoSecret. Output is base64(nonce|ciphertext).
func EncryptSecretAESGCM(plaintext string) (string, error) {
	if plaintext == "" {
		return "", ErrSecretEmpty
	}
	block, err := aes.NewCipher(deriveCryptoKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// DecryptSecretAESGCM decrypts a value produced by EncryptSecretAESGCM.
func DecryptSecretAESGCM(encoded string) (string, error) {
	if encoded == "" {
		return "", ErrCiphertextEmpty
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", ErrCiphertextInvalid
	}
	block, err := aes.NewCipher(deriveCryptoKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", ErrCiphertextInvalid
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrCiphertextInvalid
	}
	return string(plain), nil
}

// SecretHint returns a short display hint (last up to 4 runes) for a secret.
func SecretHint(secret string) string {
	runes := []rune(secret)
	if len(runes) == 0 {
		return ""
	}
	if len(runes) <= 4 {
		return string(runes)
	}
	return string(runes[len(runes)-4:])
}

func deriveCryptoKey() []byte {
	sum := sha256.Sum256([]byte(CryptoSecret))
	return sum[:]
}
