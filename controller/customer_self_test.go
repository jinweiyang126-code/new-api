package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestValidateSelfRegisterOrgName(t *testing.T) {
	_, err := validateSelfRegisterOrgName("  ")
	require.Error(t, err)

	name, err := validateSelfRegisterOrgName("  Acme  ")
	require.NoError(t, err)
	require.Equal(t, "Acme", name)

	long := strings.Repeat("组", maxSelfRegisterOrgNameRunes+1)
	_, err = validateSelfRegisterOrgName(long)
	require.Error(t, err)
}

func TestNormalizeSelfRegisterInviteEmails(t *testing.T) {
	got := normalizeSelfRegisterInviteEmails([]string{
		" a@example.com ",
		"not-an-email",
		"A@example.com",
		"",
		"b@example.com",
	})
	require.Equal(t, []string{"a@example.com", "b@example.com"}, got)
}

func TestSelfCreateCustomerCreatesOwnerCustomer(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "self-owner", common.RoleCommonUser)
	owner.Email = "owner@example.com"
	require.NoError(t, db.Save(owner).Error)
	previous := common.CustomerSelfRegisterEnabled
	common.CustomerSelfRegisterEnabled = true
	t.Cleanup(func() { common.CustomerSelfRegisterEnabled = previous })

	r := gin.New()
	r.POST("/customers/self", func(c *gin.Context) {
		c.Set("id", owner.Id)
		c.Set("role", common.RoleCommonUser)
		c.Next()
	}, SelfCreateCustomer)

	body, _ := json.Marshal(map[string]any{
		"organization_name": "Self Org",
		"invite_emails":     []string{"member@example.com", "not-valid", "owner@example.com"},
	})
	req := httptest.NewRequest(http.MethodPost, "/customers/self", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, true, resp["success"])
	data := resp["data"].(map[string]any)
	require.NotZero(t, data["customer_id"])

	var user model.User
	require.NoError(t, db.First(&user, owner.Id).Error)
	require.Equal(t, int(data["customer_id"].(float64)), user.CustomerId)

	customer, err := model.GetCustomerById(user.CustomerId)
	require.NoError(t, err)
	require.Equal(t, "Self Org", customer.Name)
	require.Equal(t, 0, customer.Quota)
	require.False(t, customer.ByokEnabled)
	require.Equal(t, model.UpstreamModeShared, customer.UpstreamMode)

	var invites []model.CustomerInvitation
	require.NoError(t, db.Where("customer_id = ?", customer.Id).Find(&invites).Error)
	require.Len(t, invites, 1)
	require.Equal(t, "member@example.com", invites[0].Email)
}

func TestSelfCreateCustomerDisabled(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "self-disabled", common.RoleCommonUser)
	previous := common.CustomerSelfRegisterEnabled
	common.CustomerSelfRegisterEnabled = false
	t.Cleanup(func() { common.CustomerSelfRegisterEnabled = previous })

	r := gin.New()
	r.POST("/customers/self", func(c *gin.Context) {
		c.Set("id", owner.Id)
		c.Next()
	}, SelfCreateCustomer)

	body, _ := json.Marshal(map[string]any{"organization_name": "Nope"})
	req := httptest.NewRequest(http.MethodPost, "/customers/self", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, false, resp["success"])
}

func TestSelfCreateCustomerRequiresName(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "self-noname", common.RoleCommonUser)
	previous := common.CustomerSelfRegisterEnabled
	common.CustomerSelfRegisterEnabled = true
	t.Cleanup(func() { common.CustomerSelfRegisterEnabled = previous })

	r := gin.New()
	r.POST("/customers/self", func(c *gin.Context) {
		c.Set("id", owner.Id)
		c.Next()
	}, SelfCreateCustomer)

	body, _ := json.Marshal(map[string]any{"organization_name": "  "})
	req := httptest.NewRequest(http.MethodPost, "/customers/self", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, false, resp["success"])

	var user model.User
	require.NoError(t, db.First(&user, owner.Id).Error)
	require.Equal(t, 0, user.CustomerId)
}

func TestSelfCreateCustomerRejectsExistingCustomer(t *testing.T) {
	db := setupCustomerControllerTestDB(t)
	owner := createCustomerTestUser(t, db, "self-dup", common.RoleCommonUser)
	_, err := model.CreateCustomerWithOwner(&model.Customer{Name: "Existing"}, owner.Id)
	require.NoError(t, err)
	previous := common.CustomerSelfRegisterEnabled
	common.CustomerSelfRegisterEnabled = true
	t.Cleanup(func() { common.CustomerSelfRegisterEnabled = previous })

	r := gin.New()
	r.POST("/customers/self", func(c *gin.Context) {
		c.Set("id", owner.Id)
		c.Next()
	}, SelfCreateCustomer)

	body, _ := json.Marshal(map[string]any{"organization_name": "Second"})
	req := httptest.NewRequest(http.MethodPost, "/customers/self", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, false, resp["success"])
}
