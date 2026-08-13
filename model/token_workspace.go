package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"gorm.io/gorm"
)

var (
	ErrNotWorkspaceTokenMember = errors.New("not a member of this workspace")
	ErrTokenAccessDenied       = errors.New("token access denied")
)

// M1 billing contract for workspace-scoped tokens (enforced in T08 Relay):
//
//   - WorkspaceId > 0: debit workspaces.quota only; never touch users.quota.
//   - RemainQuota (when UnlimitedQuota == false) is a secondary per-token cap
//     checked together with the workspace pool so one token cannot drain the pool alone.
//   - WorkspaceId == 0: personal token; existing user/token quota behavior unchanged.

// AssertCanCreateWorkspaceToken validates membership and that customer/workspace are enabled.
// Returns customerId to store on the token. workspaceId <= 0 means personal token (customerId=0).
func AssertCanCreateWorkspaceToken(userId, workspaceId int) (customerId int, err error) {
	if workspaceId <= 0 {
		return 0, nil
	}
	if userId <= 0 {
		return 0, ErrNotWorkspaceTokenMember
	}
	ws, err := GetWorkspaceById(workspaceId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrWorkspaceNotFound
		}
		return 0, err
	}
	if ws.Status != CustomerStatusEnabled {
		return 0, ErrWorkspaceDisabled
	}
	customer, err := GetCustomerById(ws.CustomerId)
	if err != nil {
		return 0, err
	}
	if customer.Status != CustomerStatusEnabled {
		return 0, errors.New("customer is disabled")
	}

	if cm, err := GetCustomerMember(ws.CustomerId, userId); err == nil && IsCustomerAdminRole(cm.Role) {
		return ws.CustomerId, nil
	}
	if _, err := GetWorkspaceMember(workspaceId, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrNotWorkspaceTokenMember
		}
		return 0, err
	}
	return ws.CustomerId, nil
}

// TokenListScope describes which tokens a user may see beyond their own.
type TokenListScope struct {
	UserId            int
	AdminCustomerIDs  []int
	AdminWorkspaceIDs []int
}

// BuildTokenListScope loads customer-admin and workspace-admin scopes for listing.
func BuildTokenListScope(userId int) (*TokenListScope, error) {
	scope := &TokenListScope{UserId: userId}
	if userId <= 0 {
		return scope, nil
	}
	if err := DB.Model(&CustomerMember{}).
		Where("user_id = ? AND status = ? AND role IN ?", userId, MemberStatusEnabled,
			[]string{CustomerRoleOwner, CustomerRoleAdmin}).
		Pluck("customer_id", &scope.AdminCustomerIDs).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&WorkspaceMember{}).
		Where("user_id = ? AND status = ? AND role = ?", userId, MemberStatusEnabled, WorkspaceRoleAdmin).
		Pluck("workspace_id", &scope.AdminWorkspaceIDs).Error; err != nil {
		return nil, err
	}
	return scope, nil
}

func (s *TokenListScope) apply(query *gorm.DB) *gorm.DB {
	if s == nil || s.UserId <= 0 {
		return query.Where("1 = 0")
	}
	if len(s.AdminCustomerIDs) == 0 && len(s.AdminWorkspaceIDs) == 0 {
		return query.Where("user_id = ?", s.UserId)
	}
	// Own tokens OR tokens under administered customer/workspace.
	return query.Where(
		"user_id = ? OR (customer_id > 0 AND customer_id IN ?) OR (workspace_id > 0 AND workspace_id IN ?)",
		s.UserId, nonemptyInts(s.AdminCustomerIDs), nonemptyInts(s.AdminWorkspaceIDs),
	)
}

func nonemptyInts(ids []int) []int {
	if len(ids) == 0 {
		return []int{-1} // IN () is invalid; -1 matches nothing
	}
	return ids
}

// GetUserTokensPaged lists tokens visible to the user (own + admin scopes).
func GetUserTokensPaged(userId int, startIdx, num int, workspaceFilter int) ([]*Token, error) {
	scope, err := BuildTokenListScope(userId)
	if err != nil {
		return nil, err
	}
	q := scope.apply(DB.Model(&Token{}))
	if workspaceFilter > 0 {
		q = q.Where("workspace_id = ?", workspaceFilter)
	}
	var tokens []*Token
	err = q.Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	return tokens, err
}

// CountUserTokensScoped counts tokens visible under the same rules as GetUserTokensPaged.
func CountUserTokensScoped(userId int, workspaceFilter int) (int64, error) {
	scope, err := BuildTokenListScope(userId)
	if err != nil {
		return 0, err
	}
	q := scope.apply(DB.Model(&Token{}))
	if workspaceFilter > 0 {
		q = q.Where("workspace_id = ?", workspaceFilter)
	}
	var total int64
	err = q.Count(&total).Error
	return total, err
}

// SearchUserTokensScoped searches within the user's token visibility scope.
func SearchUserTokensScoped(userId int, keyword, tokenKey string, offset, limit, workspaceFilter int) (tokens []*Token, total int64, err error) {
	if limit <= 0 || limit > searchHardLimit {
		limit = searchHardLimit
	}
	if offset < 0 {
		offset = 0
	}
	if tokenKey != "" {
		tokenKey = strings.TrimPrefix(tokenKey, "sk-")
	}

	maxTokens := operation_setting.GetMaxUserTokens()
	hasFuzzy := strings.Contains(keyword, "%") || strings.Contains(tokenKey, "%")
	if hasFuzzy {
		count, err := CountUserTokens(userId)
		if err != nil {
			common.SysLog("failed to count user tokens: " + err.Error())
			return nil, 0, errors.New("获取令牌数量失败")
		}
		if int(count) > maxTokens {
			return nil, 0, errors.New("令牌数量超过上限，仅允许精确搜索，请勿使用 % 通配符")
		}
	}

	scope, err := BuildTokenListScope(userId)
	if err != nil {
		return nil, 0, err
	}
	baseQuery := scope.apply(DB.Model(&Token{}))
	if workspaceFilter > 0 {
		baseQuery = baseQuery.Where("workspace_id = ?", workspaceFilter)
	}
	if keyword != "" {
		keywordPattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where("name LIKE ? ESCAPE '!'", keywordPattern)
	}
	if tokenKey != "" {
		tokenPattern, err := sanitizeLikePattern(tokenKey)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where(commonKeyCol+" LIKE ? ESCAPE '!'", tokenPattern)
	}
	if err := baseQuery.Limit(maxTokens).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = baseQuery.Order("id desc").Offset(offset).Limit(limit).Find(&tokens).Error
	return tokens, total, err
}

// CanAccessToken reports whether user may view/manage the token
// (owner, customer admin, workspace admin, or platform root via systemRole).
func CanAccessToken(userId, systemRole int, token *Token) bool {
	if token == nil || userId <= 0 {
		return false
	}
	if systemRole >= common.RoleRootUser {
		return true
	}
	if token.UserId == userId {
		return true
	}
	if token.CustomerId > 0 {
		if cm, err := GetCustomerMember(token.CustomerId, userId); err == nil && IsCustomerAdminRole(cm.Role) {
			return true
		}
	}
	if token.WorkspaceId > 0 {
		if wm, err := GetWorkspaceMember(token.WorkspaceId, userId); err == nil && IsWorkspaceAdminRole(wm.Role) {
			return true
		}
	}
	return false
}

// GetTokenForUser loads a token if the user can access it.
func GetTokenForUser(id, userId, systemRole int) (*Token, error) {
	var token Token
	err := DB.Where("id = ?", id).First(&token).Error
	if err != nil {
		return nil, err
	}
	if !CanAccessToken(userId, systemRole, &token) {
		return nil, ErrTokenAccessDenied
	}
	return &token, nil
}
