/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ModelPerfBadgeData } from './components/model-perf-badge'
import type { PricingData } from './types'

// Example catalog for visual review only; prices and metadata are illustrative.
const entries = [
  [
    'gpt-4o',
    'OpenAI',
    'OpenAI',
    'A versatile multimodal model for chat, visual understanding, and everyday tasks.',
  ],
  [
    'gpt-4o-mini',
    'OpenAI',
    'OpenAI',
    'A compact model for fast responses and lightweight applications.',
  ],
  [
    'claude-sonnet',
    'Anthropic',
    'Anthropic',
    'A balanced model for writing, coding, and detailed analysis.',
  ],
  [
    'claude-opus',
    'Anthropic',
    'Anthropic',
    'A capable model for complex reasoning and long-form work.',
  ],
  [
    'gemini-pro',
    'Google',
    'Gemini.Color',
    'A multimodal model for working with text, images, and long documents.',
  ],
  [
    'gemini-flash',
    'Google',
    'Gemini.Color',
    'Fast responses for interactive applications and high-volume tasks.',
  ],
  [
    'deepseek-chat',
    'DeepSeek',
    'DeepSeek.Color',
    'A general-purpose chat model for conversations and code.',
  ],
  [
    'deepseek-reasoner',
    'DeepSeek',
    'DeepSeek.Color',
    'A reasoning model for multi-step problem solving.',
  ],
  [
    'image-generation',
    'OpenAI',
    'OpenAI',
    'An image generation example with per-request billing.',
  ],
]
const vendors = [...new Set(entries.map((entry) => entry[1]))].map(
  (name, index) => ({
    id: index + 1,
    name,
    icon: entries.find((entry) => entry[1] === name)?.[2],
  })
)

export const pricingPreviewData: PricingData = {
  success: true,
  vendors,
  group_ratio: { default: 1, premium: 1.2 },
  usable_group: {
    default: { desc: 'Default', ratio: 1 },
    premium: { desc: 'Premium', ratio: 1.2 },
  },
  supported_endpoint: { openai: '/v1/chat/completions' },
  auto_groups: [],
  data: entries.map(([model_name, vendor_name, icon, description], index) => ({
    id: index + 1,
    model_name,
    description,
    icon,
    vendor_id: vendors.find((vendor) => vendor.name === vendor_name)?.id,
    quota_type: index === 8 ? 1 : 0,
    model_ratio: 0.5 + index * 0.25,
    completion_ratio: 3,
    model_price: index === 8 ? 0.04 : undefined,
    cache_ratio: index % 2 === 0 ? 0.25 : undefined,
    enable_groups: ['default', 'premium'],
    tags: index === 7 ? 'reasoning,code' : 'chat,multimodal',
    supported_endpoint_types: ['openai'],
    context_length: 128000,
    max_output_tokens: 8192,
  })),
}

// Simulated post-call metrics to exercise normal, degraded, and failed statuses.
export const pricingPreviewPerformance: Record<string, ModelPerfBadgeData> =
  Object.fromEntries(
    entries.map(([name], index) => [
      name,
      {
        avg_latency_ms: [420, 180, 780, 1600, 650, 210, 520, 2400, 3200][index],
        avg_tps: [86, 142, 64, 32, 95, 168, 72, 28, 4][index],
        success_rate: [99.9, 100, 98, 94, 99.5, 100, 88, 65, 99][index],
        recent_success_rates: (
          { 6: [99, 94, 88], 7: [96, 85, 65] } as Record<number, number[]>
        )[index] ?? [99, 99.5, 100],
      },
    ])
  )
