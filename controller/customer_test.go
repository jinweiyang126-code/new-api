package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomerControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousType := common.MainDatabaseType()
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Customer{}, &model.Workspace{},
		&model.CustomerMember{}, &model.WorkspaceMember{}, &model.CustomerInvitation{},
		&model.Log{}, &model.OrganizationWallet{},
	))
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func createCustomerTestUser(t *testing.T, db *gorm.DB, name string, role int) *model.User {
	t.Helper()
	u := &model.User{
		Username: name, Password: "password123", Role: role,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: name + "-aff",
	}
	require.NoError(t, db.Create(u).Error)
	return u
}

func TestTopUpCustomerRejectsNonRoot(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "topup-owner", common.RoleCommonUser)
	admin := createCustomerTestUser(t, db, "topup-admin", common.RoleAdminUser)
	customer := &model.Customer{Name: "Topup Target"}
	_, err := model.CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	r := gin.New()
	r.POST("/customers/:id/topup", func(c *gin.Context) {
		c.Set("id", admin.Id)
		c.Set("role", common.RoleAdminUser)
		c.Next()
	}, func(c *gin.Context) {
		// Simulate RootAuth gate used on the real route.
		if !service.IsRootUser(c.GetInt("role")) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
			c.Abort()
			return
		}
		c.Next()
	}, TopUpCustomer)

	body, _ := json.Marshal(map[string]int{"amount": 100})
	req := httptest.NewRequest(http.MethodPost, "/customers/"+fmt.Sprintf("%d", customer.Id)+"/topup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusForbidden, w.Code)

	loaded, err := model.GetCustomerById(customer.Id)
	require.NoError(t, err)
	require.Equal(t, 0, loaded.QuotaLimit)
}

func TestTopUpCustomerDeprecatedEvenForRoot(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "topup-owner2", common.RoleCommonUser)
	root := createCustomerTestUser(t, db, "topup-root", common.RoleRootUser)
	customer := &model.Customer{Name: "Topup OK"}
	_, err := model.CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	r := gin.New()
	r.POST("/customers/:id/topup", func(c *gin.Context) {
		c.Set("id", root.Id)
		c.Set("role", common.RoleRootUser)
		c.Next()
	}, TopUpCustomer)

	body, _ := json.Marshal(map[string]int{"amount": 2500})
	req := httptest.NewRequest(http.MethodPost, "/customers/"+fmt.Sprintf("%d", customer.Id)+"/topup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, false, resp["success"], "body=%s", w.Body.String())
	require.Contains(t, fmt.Sprint(resp["message"]), "deprecated")

	loaded, err := model.GetCustomerById(customer.Id)
	require.NoError(t, err)
	require.Equal(t, 0, loaded.QuotaLimit)
}

func TestSetCustomerQuotaLimitAllowsRoot(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "limit-owner", common.RoleCommonUser)
	root := createCustomerTestUser(t, db, "limit-root", common.RoleRootUser)
	customer := &model.Customer{Name: "Limit OK"}
	_, err := model.CreateCustomerWithOwner(customer, owner.Id)
	require.NoError(t, err)

	r := gin.New()
	r.POST("/customers/:id/quota-limit", func(c *gin.Context) {
		c.Set("id", root.Id)
		c.Set("role", common.RoleRootUser)
		c.Next()
	}, SetCustomerQuotaLimit)

	body, _ := json.Marshal(map[string]int{"quota_limit": 2500})
	req := httptest.NewRequest(http.MethodPost, "/customers/"+fmt.Sprintf("%d", customer.Id)+"/quota-limit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, true, resp["success"], "body=%s code=%d", w.Body.String(), w.Code)

	loaded, err := model.GetCustomerById(customer.Id)
	require.NoError(t, err)
	require.Equal(t, 2500, loaded.QuotaLimit)
}
