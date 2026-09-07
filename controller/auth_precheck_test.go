package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAuthPrecheckTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousPasswordLogin := common.PasswordLoginEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db
	common.PasswordLoginEnabled = true
	t.Cleanup(func() {
		model.DB = previousDB
		common.PasswordLoginEnabled = previousPasswordLogin
	})
	return db
}

func TestLoginPrecheckAcceptsValidCredentialsWithoutSession(t *testing.T) {
	db := setupAuthPrecheckTestDB(t)
	hash, err := common.Password2Hash("CorrectPassword1")
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.User{
		Username: "precheck-ok",
		Password: hash,
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"username":"precheck-ok","password":"CorrectPassword1"}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/precheck", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	LoginPrecheck(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
}

func TestLoginPrecheckRejectsWrongPassword(t *testing.T) {
	db := setupAuthPrecheckTestDB(t)
	hash, err := common.Password2Hash("CorrectPassword1")
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.User{
		Username: "precheck-bad",
		Password: hash,
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"username":"precheck-bad","password":"WrongPassword1"}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/precheck", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	LoginPrecheck(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}

func TestCheckUsernameReportsAvailability(t *testing.T) {
	db := setupAuthPrecheckTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Username: "taken-name",
		Password: "unused",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
	}).Error)

	gin.SetMode(gin.TestMode)

	t.Run("taken", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(
			http.MethodPost,
			"/api/user/check-username",
			bytes.NewReader([]byte(`{"username":"taken-name"}`)),
		)
		c.Request.Header.Set("Content-Type", "application/json")
		CheckUsername(c)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Available bool `json:"available"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		assert.True(t, response.Success)
		assert.False(t, response.Data.Available)
	})

	t.Run("free", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(
			http.MethodPost,
			"/api/user/check-username",
			bytes.NewReader([]byte(`{"username":"fresh-name"}`)),
		)
		c.Request.Header.Set("Content-Type", "application/json")
		CheckUsername(c)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Available bool `json:"available"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		assert.True(t, response.Success)
		assert.True(t, response.Data.Available)
	})
}

func TestCheckVerificationCodeDoesNotConsumeCode(t *testing.T) {
	setupAuthPrecheckTestDB(t)
	email := "verify-precheck@example.com"
	code := "123456"
	common.RegisterVerificationCodeWithKey(email, code, common.EmailVerificationPurpose)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"email":"verify-precheck@example.com","code":"123456"}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/check-verification-code", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	CheckVerificationCode(c)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.True(t, common.VerifyCodeWithKey(email, code, common.EmailVerificationPurpose))
}
