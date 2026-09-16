package model

import (
	"strings"
)

// 简化的供应商映射规则（canonical 英文名，避免库内出现中英重复供应商）
var defaultVendorRules = map[string]string{
	"gpt":      "OpenAI",
	"dall-e":   "OpenAI",
	"whisper":  "OpenAI",
	"o1":       "OpenAI",
	"o3":       "OpenAI",
	"o4":       "OpenAI",
	"claude":   "Anthropic",
	"gemini":   "Google",
	"moonshot": "Moonshot",
	"kimi":     "Moonshot",
	"chatglm":  "Zhipu",
	"glm-":     "Zhipu",
	"qwen":     "Alibaba",
	"deepseek": "DeepSeek",
	"seedream": "ByteDance",
	"seedance": "ByteDance",
	"abab":     "MiniMax",
	"minimax":  "MiniMax",
	"ernie":    "Baidu",
	"spark":    "Xunfei",
	"hunyuan":  "Tencent",
	"command":  "Cohere",
	"@cf/":     "Cloudflare",
	"360":      "360",
	"yi":       "01.AI",
	"jina":     "Jina",
	"mistral":  "Mistral",
	"grok":     "xAI",
	"llama":    "Meta",
	"doubao":   "ByteDance",
	"kling":    "Kuaishou",
	"jimeng":   "Jimeng",
	"vidu":     "Vidu",
}

// 供应商默认图标映射（key 与 defaultVendorRules 的 canonical 名一致）
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Claude.Color",
	"Google":     "Gemini.Color",
	"Moonshot":   "Moonshot",
	"Zhipu":      "Zhipu.Color",
	"Alibaba":    "Qwen.Color",
	"DeepSeek":   "DeepSeek.Color",
	"MiniMax":    "Minimax.Color",
	"Baidu":      "Wenxin.Color",
	"Xunfei":     "Spark.Color",
	"Tencent":    "Hunyuan.Color",
	"Cohere":     "Cohere.Color",
	"Cloudflare": "Cloudflare.Color",
	"360":        "Ai360.Color",
	"01.AI":      "Yi.Color",
	"Jina":       "Jina",
	"Mistral":    "Mistral.Color",
	"xAI":        "XAI",
	"Meta":       "Ollama",
	"ByteDance":  "Doubao.Color",
	"Kuaishou":   "Kling.Color",
	"Jimeng":     "Jimeng.Color",
	"Vidu":       "Vidu",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		if _, exists := metaMap[modelName]; exists {
			continue
		}

		// 匹配供应商
		vendorID := 0
		modelLower := strings.ToLower(modelName)
		for pattern, vendorName := range defaultVendorRules {
			if strings.Contains(modelLower, pattern) {
				vendorID = getOrCreateVendor(vendorName, vendorMap)
				break
			}
		}

		// 创建模型元数据
		metaMap[modelName] = &Model{
			ModelName: modelName,
			VendorID:  vendorID,
			Status:    1,
			NameRule:  NameRuleExact,
		}
	}
}

// 查找或创建供应商
func getOrCreateVendor(vendorName string, vendorMap map[int]*Vendor) int {
	// 查找现有供应商
	for id, vendor := range vendorMap {
		if vendor.Name == vendorName {
			return id
		}
	}

	// 创建新供应商
	newVendor := &Vendor{
		Name:   vendorName,
		Status: 1,
		Icon:   getDefaultVendorIcon(vendorName),
	}

	if err := newVendor.Insert(); err != nil {
		return 0
	}

	vendorMap[newVendor.Id] = newVendor
	return newVendor.Id
}

// 获取供应商默认图标
func getDefaultVendorIcon(vendorName string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return icon
	}
	return ""
}

// InferDefaultVendor maps a model name to a built-in vendor and icon without
// writing model/vendor catalog rows (BYOK / unregistered models stay off plaza).
func InferDefaultVendor(modelName string) (vendorName, vendorIcon string) {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if i := strings.LastIndex(name, "/"); i >= 0 {
		name = name[i+1:]
	}
	if name == "" {
		return "", ""
	}
	bestLen := 0
	bestVendor := ""
	for pattern, vendor := range defaultVendorRules {
		if !modelMatchesVendorPattern(name, pattern) {
			continue
		}
		if len(pattern) > bestLen {
			bestLen = len(pattern)
			bestVendor = vendor
		}
	}
	if bestVendor == "" {
		return "", ""
	}
	return bestVendor, getDefaultVendorIcon(bestVendor)
}

func modelMatchesVendorPattern(modelLower, pattern string) bool {
	p := strings.ToLower(pattern)
	if strings.ContainsAny(p, "/@") {
		return strings.Contains(modelLower, p)
	}
	return strings.HasPrefix(modelLower, p)
}
