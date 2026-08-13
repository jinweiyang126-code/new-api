package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCustomerAuthMiddlewareTest(t *testing.T) (customerID, memberID, outsiderID, rootID int) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Customer{},
		&model.Workspace{},
		&model.CustomerMember{},
		&model.WorkspaceMember{},
	))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	createUser := func(name string, role int) int {
		u := &model.User{
			Username: name, Password: "password123", Role: role,
			Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
			AffCode: name + "-aff",
		}
		require.NoError(t, db.Create(u).Error)
		return u.Id
	}

	rootID = createUser("root", common.RoleRootUser)
	memberID = createUser("member", common.RoleCommonUser)
	outsiderID = createUser("outsider", common.RoleCommonUser)

	customer := &model.Customer{
		Name: "Acme", Slug: "acme", Status: model.CustomerStatusEnabled,
		OwnerUserId: memberID, UpstreamMode: model.UpstreamModeShared, AllowGlobalFallback: true,
	}
	require.NoError(t, db.Create(customer).Error)
	customerID = customer.Id

	require.NoError(t, db.Model(&model.User{}).Where("id = ?", memberID).Update("customer_id", customerID).Error)
	require.NoError(t, db.Create(&model.CustomerMember{
		CustomerId: customerID, UserId: memberID, Role: model.CustomerRoleMember, Status: model.MemberStatusEnabled,
	}).Error)
	return customerID, memberID, outsiderID, rootID
}

func TestCustomerMemberAuthForbiddenAndRootBypass(t *testing.T) {
	customerID, memberID, outsiderID, rootID := setupCustomerAuthMiddlewareTest(t)

	run := func(userID, role, wantStatus int) {
		t.Helper()
		r := gin.New()
		r.GET("/customers/:id", func(c *gin.Context) {
			c.Set("id", userID)
			c.Set("role", role)
			c.Next()
		}, CustomerMemberAuth(), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"success": true})
		})
		req := httptest.NewRequest(http.MethodGet, "/customers/"+strconv.Itoa(customerID), nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, wantStatus, w.Code)
		var body map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		if wantStatus == http.StatusOK {
			require.Equal(t, true, body["success"])
		} else {
			require.Equal(t, false, body["success"])
		}
	}

	run(outsiderID, common.RoleCommonUser, http.StatusForbidden)
	run(memberID, common.RoleCommonUser, http.StatusOK)
	run(rootID, common.RoleRootUser, http.StatusOK)
}

func TestCustomerMemberAuthCrossCustomerForbidden(t *testing.T) {
	db := setupCustomerAuthMiddlewareTestDBOnly(t)
	ownerA := createMiddlewareUser(t, db, "owner-a", common.RoleCommonUser)
	ownerB := createMiddlewareUser(t, db, "owner-b", common.RoleCommonUser)
	customerA := &model.Customer{Name: "CustA"}
	customerB := &model.Customer{Name: "CustB"}
	_, err := model.CreateCustomerWithOwner(customerA, ownerA.Id)
	require.NoError(t, err)
	_, err = model.CreateCustomerWithOwner(customerB, ownerB.Id)
	require.NoError(t, err)

	r := gin.New()
	r.GET("/customers/:id/members", func(c *gin.Context) {
		c.Set("id", ownerB.Id)
		c.Set("role", common.RoleCommonUser)
		c.Next()
	}, CustomerMemberAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
	req := httptest.NewRequest(http.MethodGet, "/customers/"+strconv.Itoa(customerA.Id)+"/members", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusForbidden, w.Code)
}

func setupCustomerAuthMiddlewareTestDBOnly(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Customer{}, &model.Workspace{},
		&model.CustomerMember{}, &model.WorkspaceMember{},
	))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	return db
}

func createMiddlewareUser(t *testing.T, db *gorm.DB, name string, role int) *model.User {
	t.Helper()
	u := &model.User{
		Username: name, Password: "password123", Role: role,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: name + "-aff",
	}
	require.NoError(t, db.Create(u).Error)
	return u
}
