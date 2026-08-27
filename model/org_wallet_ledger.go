package model

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
)

const OrgWalletLedgerContent = "org_wallet_ledger"

const (
	OrgWalletLedgerCredit = "org_wallet.credit"
	OrgWalletLedgerDebit  = "org_wallet.debit"
	OrgWalletLedgerReturn = "org_wallet.return"
)

// OrgWalletLedgerEntry is a member-visible allocate/revoke ledger row.
type OrgWalletLedgerEntry struct {
	Id            int    `json:"id"`
	Action        string `json:"action"`
	Amount        int    `json:"amount"`
	WorkspaceId   int    `json:"workspace_id"`
	WorkspaceName string `json:"workspace_name,omitempty"`
	CustomerId    int    `json:"customer_id"`
	OperatorId    int    `json:"operator_id,omitempty"`
	OperatorName  string `json:"operator_name,omitempty"`
	CreatedAt     int64  `json:"created_at"`
}

// RecordOrgWalletLedgerLog writes a member-facing org-wallet ledger entry.
func RecordOrgWalletLedgerLog(
	memberUserId, customerId, workspaceId int,
	action string,
	amount, operatorId int,
	ip string,
) {
	if memberUserId <= 0 || workspaceId <= 0 || amount <= 0 {
		return
	}
	params := map[string]interface{}{
		"workspace_id": workspaceId,
		"amount":       amount,
		"operator_id":  operatorId,
	}
	if customerId > 0 {
		params["customer_id"] = customerId
	}
	username, _ := GetUsernameById(memberUserId, false)
	other := map[string]interface{}{
		"op": buildOpField(action, params),
	}
	log := &Log{
		UserId:      memberUserId,
		Username:    username,
		CustomerId:  customerId,
		WorkspaceId: workspaceId,
		Quota:       amount,
		CreatedAt:   common.GetTimestamp(),
		Type:        LogTypeManage,
		Content:     OrgWalletLedgerContent,
		Ip:          ip,
		Other:       common.MapToJsonStr(other),
	}
	if err := createLog(log); err != nil {
		common.SysLog("failed to record org wallet ledger log: " + err.Error())
	}
}

// ListOrgWalletLedgerForUser returns paginated org-wallet ledger rows for the member.
func ListOrgWalletLedgerForUser(
	userId, customerId, workspaceId, startIdx, num int,
) ([]*OrgWalletLedgerEntry, int64, error) {
	if userId <= 0 {
		return nil, 0, nil
	}
	tx := DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND content = ?", userId, LogTypeManage, OrgWalletLedgerContent)
	if customerId > 0 {
		tx = tx.Where("customer_id = ?", customerId)
	}
	if workspaceId > 0 {
		tx = tx.Where("workspace_id = ?", workspaceId)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*Log
	if err := tx.Order("created_at desc, id desc").Limit(num).Offset(startIdx).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]*OrgWalletLedgerEntry, 0, len(rows))
	for _, row := range rows {
		entry := parseOrgWalletLedgerLog(row)
		if entry == nil {
			continue
		}
		if ws, err := GetWorkspaceById(entry.WorkspaceId); err == nil && ws != nil {
			entry.WorkspaceName = ws.Name
		}
		if entry.OperatorId > 0 {
			entry.OperatorName = GetUserDisplayLabelById(entry.OperatorId)
		}
		out = append(out, entry)
	}
	return out, total, nil
}

func parseOrgWalletLedgerLog(row *Log) *OrgWalletLedgerEntry {
	if row == nil {
		return nil
	}
	entry := &OrgWalletLedgerEntry{
		Id:          row.Id,
		Amount:      row.Quota,
		WorkspaceId: row.WorkspaceId,
		CustomerId:  row.CustomerId,
		CreatedAt:   row.CreatedAt,
	}
	if row.Other != "" {
		var other map[string]interface{}
		if err := json.Unmarshal([]byte(row.Other), &other); err == nil {
			if rawOp, ok := other["op"].(map[string]interface{}); ok {
				if action, ok := rawOp["action"].(string); ok {
					entry.Action = action
				}
				if params, ok := rawOp["params"].(map[string]interface{}); ok {
					if entry.WorkspaceId == 0 {
						entry.WorkspaceId = intFromAny(params["workspace_id"])
					}
					if entry.Amount == 0 {
						entry.Amount = intFromAny(params["amount"])
					}
					entry.OperatorId = intFromAny(params["operator_id"])
					if entry.CustomerId == 0 {
						entry.CustomerId = intFromAny(params["customer_id"])
					}
				}
			}
		}
	}
	if entry.Action == "" || entry.Amount <= 0 {
		return nil
	}
	return entry
}

func intFromAny(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}
