/*
Copyright (C) 2023-2026 QuantumNous
*/
package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

var (
	// ErrUpstreamNotConfigured means dedicated/byok candidates are empty and fallback is disabled.
	ErrUpstreamNotConfigured = errors.New("upstream_not_configured")
)

type customerUpstreamCandidate struct {
	Channel *model.Channel
	Source  string
	Priority int
}

// CustomerUsesScopedUpstream reports whether affinity/global-only selection should be skipped.
func CustomerUsesScopedUpstream(c *gin.Context) bool {
	if c == nil {
		return false
	}
	customerId := common.GetContextKeyInt(c, constant.ContextKeyCustomerId)
	if customerId <= 0 {
		return false
	}
	customer, err := model.GetCustomerById(customerId)
	if err != nil || customer == nil {
		return false
	}
	mode := strings.TrimSpace(customer.UpstreamMode)
	return mode != "" && mode != model.UpstreamModeShared
}

func selectChannelForCustomer(param *RetryParam, customerId int) (*model.Channel, string, error) {
	customer, err := model.GetCustomerById(customerId)
	if err != nil {
		return nil, param.TokenGroup, err
	}
	mode := strings.TrimSpace(customer.UpstreamMode)
	if mode == "" {
		mode = model.UpstreamModeShared
	}

	if mode == model.UpstreamModeShared {
		ch, group, err := selectGlobalSatisfiedChannel(param)
		if err != nil {
			return nil, group, err
		}
		setUpstreamSource(param.Ctx, model.UpstreamSourceShared)
		return ch, group, nil
	}

	candidates, err := buildCustomerUpstreamCandidates(customer, param.ModelName, param.RequestPath)
	if err != nil {
		return nil, param.TokenGroup, err
	}

	retry := param.GetRetry()
	if len(candidates) > 0 && retry < len(candidates) {
		picked := candidates[retry]
		setUpstreamSource(param.Ctx, picked.Source)
		logger.LogDebug(param.Ctx, "customer upstream select: customer=%d mode=%s source=%s channel=%d retry=%d",
			customerId, mode, picked.Source, picked.Channel.Id, retry)
		return picked.Channel, "customer", nil
	}

	if customer.AllowGlobalFallback {
		ch, group, err := selectGlobalSatisfiedChannel(param)
		if err != nil {
			return nil, group, err
		}
		if ch == nil && len(candidates) == 0 {
			return nil, group, ErrUpstreamNotConfigured
		}
		setUpstreamSource(param.Ctx, model.UpstreamSourceShared)
		return ch, group, nil
	}

	if len(candidates) == 0 {
		return nil, param.TokenGroup, ErrUpstreamNotConfigured
	}
	// Exhausted dedicated/byok candidates with no fallback.
	return nil, "customer", nil
}

func buildCustomerUpstreamCandidates(customer *model.Customer, modelName, requestPath string) ([]customerUpstreamCandidate, error) {
	mode := strings.TrimSpace(customer.UpstreamMode)
	var out []customerUpstreamCandidate

	useDedicated := mode == model.UpstreamModeDedicated || mode == model.UpstreamModeHybrid
	useByok := (mode == model.UpstreamModeByok || mode == model.UpstreamModeHybrid) && customer.ByokEnabled

	if useDedicated {
		bindings, err := model.ListCustomerChannelBindings(customer.Id)
		if err != nil {
			return nil, err
		}
		for _, b := range bindings {
			if b == nil || b.Status != model.CustomerStatusEnabled || b.ChannelId <= 0 {
				continue
			}
			ch, err := model.CacheGetChannel(b.ChannelId)
			if err != nil || ch == nil {
				ch, err = model.GetChannelById(b.ChannelId, true)
				if err != nil || ch == nil {
					continue
				}
			}
			if ch.Status != common.ChannelStatusEnabled {
				continue
			}
			if !channelSupportsRequestPath(ch, requestPath, modelName) {
				continue
			}
			if !channelSupportsModelName(ch, modelName) {
				continue
			}
			cloned := *ch
			if strings.TrimSpace(b.ModelMapping) != "" {
				mapping := b.ModelMapping
				cloned.ModelMapping = &mapping
			}
			prio := b.Priority
			if prio == 0 && ch.Priority != nil {
				prio = int(*ch.Priority)
			}
			out = append(out, customerUpstreamCandidate{
				Channel:  &cloned,
				Source:   model.UpstreamSourceDedicated,
				Priority: prio,
			})
		}
	}

	if useByok {
		creds, err := model.ListEnabledUpstreamCredentialsForRelay(customer.Id)
		if err != nil {
			return nil, err
		}
		for _, cred := range creds {
			if cred == nil {
				continue
			}
			if !credentialSupportsModel(cred, modelName) {
				continue
			}
			ch, err := assembleByokChannel(cred)
			if err != nil {
				continue
			}
			if !channelSupportsRequestPath(ch, requestPath, modelName) {
				continue
			}
			out = append(out, customerUpstreamCandidate{
				Channel:  ch,
				Source:   model.UpstreamSourceByok,
				Priority: cred.Priority,
			})
		}
	}

	sortCustomerUpstreamCandidates(out)
	return out, nil
}

func sortCustomerUpstreamCandidates(items []customerUpstreamCandidate) {
	// Higher priority first; stable by channel id for deterministic retries.
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].Priority > items[i].Priority ||
				(items[j].Priority == items[i].Priority && items[j].Channel.Id < items[i].Channel.Id) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
}

func assembleByokChannel(cred *model.CustomerUpstreamCredential) (*model.Channel, error) {
	plain, err := common.DecryptSecretAESGCM(cred.KeyCiphertext)
	if err != nil {
		return nil, err
	}
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return nil, errors.New("empty byok key")
	}
	channelType := resolveByokChannelType(cred.Type)
	baseURL := strings.TrimSpace(cred.BaseURL)
	name := cred.Name
	if name == "" {
		name = fmt.Sprintf("byok-%d", cred.Id)
	}
	models := normalizeCredentialModels(cred.Models)
	ch := &model.Channel{
		Id:      -cred.Id, // ephemeral; never persist used_quota
		Type:    channelType,
		Key:     plain,
		Status:  common.ChannelStatusEnabled,
		Name:    name,
		Models:  models,
		Group:   "byok",
		BaseURL: &baseURL,
	}
	return ch, nil
}

func resolveByokChannelType(typeStr string) int {
	typeStr = strings.TrimSpace(typeStr)
	if typeStr == "" {
		return constant.ChannelTypeOpenAI
	}
	if n, err := strconv.Atoi(typeStr); err == nil && n > 0 {
		return n
	}
	lower := strings.ToLower(typeStr)
	switch lower {
	case "openai":
		return constant.ChannelTypeOpenAI
	case "azure":
		return constant.ChannelTypeAzure
	case "anthropic", "claude":
		return constant.ChannelTypeAnthropic
	case "gemini", "google":
		return constant.ChannelTypeGemini
	case "custom":
		return constant.ChannelTypeCustom
	}
	for id, name := range constant.ChannelTypeNames {
		if strings.EqualFold(name, typeStr) {
			return id
		}
	}
	return constant.ChannelTypeOpenAI
}

func normalizeCredentialModels(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "[") {
		var arr []string
		if err := json.Unmarshal([]byte(raw), &arr); err == nil {
			return strings.Join(arr, ",")
		}
	}
	return raw
}

func credentialSupportsModel(cred *model.CustomerUpstreamCredential, modelName string) bool {
	raw := strings.TrimSpace(cred.Models)
	if raw == "" {
		return true
	}
	normalized := normalizeCredentialModels(raw)
	return modelNameInCSV(normalized, modelName)
}

func channelSupportsModelName(ch *model.Channel, modelName string) bool {
	if ch == nil {
		return false
	}
	models := ch.GetModels()
	if len(models) == 0 {
		return false
	}
	for _, m := range models {
		if strings.TrimSpace(m) == modelName {
			return true
		}
	}
	return false
}

func modelNameInCSV(csv, modelName string) bool {
	for _, m := range strings.Split(csv, ",") {
		if strings.TrimSpace(m) == modelName {
			return true
		}
	}
	return false
}

func setUpstreamSource(c *gin.Context, source string) {
	if c == nil || source == "" {
		return
	}
	common.SetContextKey(c, constant.ContextKeyUpstreamSource, source)
}

// channelSupportsRequestPath is defined in middleware; duplicate minimal check for service package.
func channelSupportsRequestPath(channel *model.Channel, requestPath string, requestModel string) bool {
	if channel == nil {
		return false
	}
	if channel.Type != constant.ChannelTypeAdvancedCustom {
		return true
	}
	config := channel.GetOtherSettings().AdvancedCustom
	return config != nil && config.SupportsPathForModel(requestPath, requestModel)
}
