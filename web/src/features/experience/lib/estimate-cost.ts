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
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import { getDisplayGroupRatio } from '@/features/pricing/lib/model-helpers'
import type { PricingModel } from '@/features/pricing/types'
import { formatCurrencyFromUSD } from '@/lib/currency'

export type EstimatedCostKind =
  | 'per_image'
  | 'per_second'
  | 'usage_based'
  | 'unknown'

export type EstimatedCost = {
  kind: EstimatedCostKind
  /** USD before display conversion; only set for priced kinds */
  usd?: number
  formatted?: string
}

/**
 * Map experience-center aspect ratio to dall-e pixel size used by backend
 * ImagePriceRatio (relaykit/dto/openai_image.go).
 */
export function mapAspectRatioToImageSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case '16:9':
    case '4:3':
      return '1792x1024'
    case '9:16':
    case '3:4':
      return '1024x1792'
    case '1:1':
    default:
      return '1024x1024'
  }
}

/** Size × quality multiplier for dall-e fixed-price models. */
export function getImagePriceRatio(
  modelName: string,
  aspectRatio: string,
  quality = 'standard'
): number {
  if (!modelName.startsWith('dall-e')) return 1

  const size = mapAspectRatioToImageSize(aspectRatio)
  let sizeRatio = 1
  if (size === '256x256') sizeRatio = 0.4
  else if (size === '512x512') sizeRatio = 0.45
  else if (size === '1024x1024') sizeRatio = 1
  else if (size === '1024x1792' || size === '1792x1024') sizeRatio = 2

  let qualityRatio = 1
  if (modelName === 'dall-e-3' && quality === 'hd') {
    qualityRatio =
      size === '1024x1792' || size === '1792x1024' ? 1.5 : 2
  }

  return sizeRatio * qualityRatio
}

/**
 * Sora-style size multiplier (relay/channel/task/sora/adaptor.go).
 * 720p / 1080p maps stay at 1; only 1792×1024 / 1024×1792 bump.
 */
export function getVideoSizeMultiplier(
  resolution: string,
  aspectRatio: string
): number {
  const size = mapVideoPixelSize(resolution, aspectRatio)
  if (size === '1792x1024' || size === '1024x1792') return 1.666667
  return 1
}

export function mapVideoPixelSize(
  resolution: string,
  aspectRatio: string
): string {
  const landscape = aspectRatio === '16:9' || aspectRatio === '4:3'
  const portrait = aspectRatio === '9:16' || aspectRatio === '3:4'

  if (landscape) {
    return resolution === '1080p' ? '1920x1080' : '1280x720'
  }
  if (portrait) {
    return resolution === '1080p' ? '1080x1920' : '720x1280'
  }
  return resolution === '1080p' ? '1080x1080' : '720x720'
}

function formatUsd(usd: number): string {
  return formatCurrencyFromUSD(usd, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

function resolveGroupRatio(
  model: PricingModel,
  userGroup?: string
): number {
  return getDisplayGroupRatio(model, userGroup)
}

/**
 * Per-image estimate for fixed-price image models.
 * Mirrors: model_price × ImagePriceRatio × group_ratio (n billed separately).
 */
export function estimateImageUnitCost(params: {
  model?: PricingModel
  userGroup?: string
  aspectRatio: string
  quality?: string
}): EstimatedCost {
  const { model, userGroup, aspectRatio, quality } = params
  if (!model) return { kind: 'unknown' }

  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return { kind: 'usage_based' }
  }

  const groupRatio = resolveGroupRatio(model, userGroup)
  const imageRatio = getImagePriceRatio(
    model.model_name,
    aspectRatio,
    quality
  )
  const usd = (model.model_price || 0) * groupRatio * imageRatio
  return { kind: 'per_image', usd, formatted: formatUsd(usd) }
}

/**
 * Per-second estimate for task video models.
 * Mirrors: model_price × size × group_ratio (seconds applied at settle).
 */
export function estimateVideoUnitCost(params: {
  model?: PricingModel
  userGroup?: string
  resolution: string
  aspectRatio: string
}): EstimatedCost {
  const { model, userGroup, resolution, aspectRatio } = params
  if (!model) return { kind: 'unknown' }

  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    // Ratio-only fallback on backend ≈ (model_ratio / 2) USD per call base
    const groupRatio = resolveGroupRatio(model, userGroup)
    const sizeMult = getVideoSizeMultiplier(resolution, aspectRatio)
    const usd = (model.model_ratio / 2) * groupRatio * sizeMult
    return { kind: 'per_second', usd, formatted: formatUsd(usd) }
  }

  const groupRatio = resolveGroupRatio(model, userGroup)
  const sizeMult = getVideoSizeMultiplier(resolution, aspectRatio)
  const usd = (model.model_price || 0) * groupRatio * sizeMult
  return { kind: 'per_second', usd, formatted: formatUsd(usd) }
}

export function findPricingModel(
  models: PricingModel[],
  modelName: string
): PricingModel | undefined {
  return models.find((m) => m.model_name === modelName)
}

export function filterModelsByEndpoint(
  models: PricingModel[],
  endpoint: string
): PricingModel[] {
  return models.filter((m) =>
    (m.supported_endpoint_types ?? []).includes(endpoint)
  )
}
