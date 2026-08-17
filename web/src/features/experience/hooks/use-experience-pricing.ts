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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ENDPOINT_TYPES } from '@/features/pricing/constants'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { useAuthStore } from '@/stores/auth-store'

import {
  estimateImageUnitCost,
  estimateVideoUnitCost,
  filterModelsByEndpoint,
  findPricingModel,
} from '../lib/estimate-cost'

type ImageEstimateArgs = {
  mode: 'images'
  modelName: string
  aspectRatio: string
  quality?: string
}

type VideoEstimateArgs = {
  mode: 'videos'
  modelName: string
  resolution: string
  aspectRatio: string
}

type Args = ImageEstimateArgs | VideoEstimateArgs

/**
 * Resolve selectable models + estimated cost from /api/pricing,
 * formatted with the site currency display (same as balance / pricing).
 */
export function useExperiencePricing(args: Args) {
  const { t } = useTranslation()
  const { models, isLoading } = usePricingData()
  const userGroup = useAuthStore((s) => s.auth.user?.group)

  const endpoint =
    args.mode === 'images'
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI_VIDEO

  const availableModels = useMemo(
    () => filterModelsByEndpoint(models, endpoint),
    [models, endpoint]
  )

  const pricingModel = useMemo(
    () => findPricingModel(models, args.modelName),
    [models, args.modelName]
  )

  const aspectRatio = args.aspectRatio
  const quality = args.mode === 'images' ? args.quality : undefined
  const resolution = args.mode === 'videos' ? args.resolution : undefined

  const estimate = useMemo(() => {
    if (args.mode === 'images') {
      return estimateImageUnitCost({
        model: pricingModel,
        userGroup,
        aspectRatio,
        quality,
      })
    }
    return estimateVideoUnitCost({
      model: pricingModel,
      userGroup,
      resolution: resolution ?? '720p',
      aspectRatio,
    })
  }, [
    args.mode,
    aspectRatio,
    quality,
    resolution,
    pricingModel,
    userGroup,
  ])

  const displayText = useMemo(() => {
    if (isLoading) return '…'
    switch (estimate.kind) {
      case 'per_image':
        return t('{{amount}} / image', { amount: estimate.formatted })
      case 'per_second':
        return t('{{amount}} / second', { amount: estimate.formatted })
      case 'usage_based':
        return t('Depends on actual usage')
      case 'unknown':
      default:
        return '—'
    }
  }, [estimate, isLoading, t])

  return {
    availableModels,
    pricingModel,
    estimate,
    displayText,
    isLoading,
  }
}
