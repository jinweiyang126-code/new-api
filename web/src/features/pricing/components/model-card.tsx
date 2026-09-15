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
import { Copy } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
  isDynamicPricingModel,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
}

function billingLabel(model: PricingModel, t: (key: string) => string): string {
  if (isDynamicPricingModel(model)) return t('Dynamic Pricing')
  if (isTokenBasedModel(model)) return t('Token-based')
  return t('Per Request')
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tags = parseTags(props.model.tags)
  const groups = props.model.enable_groups || []
  const endpoints = props.model.supported_endpoint_types || []
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey
    ? getLobeIcon(modelIconKey, (24 / 36) * 40)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const hasCachedPrice = isTokenBased && props.model.cache_ratio != null
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          props.selectedGroup
        ),
      })
    : null

  const primaryGroup = groups[0]
  const bottomTagPool = [props.model.vendor_name, ...endpoints, ...tags].filter(
    Boolean
  ) as string[]
  const bottomTags = bottomTagPool.slice(0, 3)
  const hiddenCount = Math.max(bottomTagPool.length - 3, 0)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  let priceSummary: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <span className='min-w-0'>
          <span className='text-amber-700 dark:text-amber-300'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground/70 mt-0.5 line-clamp-1 block font-mono text-[11px] break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </span>
      )
    } else if (dynamicSummary.primaryEntries.length > 0) {
      priceSummary = (
        <>
          {dynamicSummary.primaryEntries.map((entry) => (
            <span
              key={entry.key}
              className='text-muted-foreground whitespace-nowrap'
            >
              {t(entry.shortLabel)}{' '}
              <span className='text-foreground font-semibold'>
                {entry.formatted}
              </span>
            </span>
          ))}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground text-sm'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isTokenBased) {
    priceSummary = (
      <>
        <span className='text-muted-foreground whitespace-nowrap'>
          {t('Input')}{' '}
          <span className='text-foreground font-semibold'>
            {formatPrice(
              props.model,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
        <span className='text-muted-foreground whitespace-nowrap'>
          {t('Output')}{' '}
          <span className='text-foreground font-semibold'>
            {formatPrice(
              props.model,
              'output',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
        {hasCachedPrice && (
          <span className='text-muted-foreground whitespace-nowrap'>
            {t('Cached')}{' '}
            <span className='text-foreground font-semibold'>
              {formatPrice(
                props.model,
                'cache',
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                props.selectedGroup
              )}
            </span>
          </span>
        )}
      </>
    )
  } else {
    priceSummary = (
      <span className='text-muted-foreground whitespace-nowrap'>
        <span className='text-foreground font-semibold'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
        </span>{' '}
        / {t('request')}
      </span>
    )
  }

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onClick()
        }
      }}
      className={cn(
        'group relative flex h-[248px] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-[#e8e8e8] bg-white p-[19px] transition-colors',
        'hover:bg-[#f7f7f7]',
        'dark:border-white/10 dark:bg-[#1e1e1f] dark:hover:bg-[#262525]'
      )}
    >
      <div className='flex items-start gap-3'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] dark:bg-[#252526]'>
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <h3 className='text-foreground truncate text-base leading-tight font-semibold'>
              {props.model.model_name}
            </h3>
            <button
              type='button'
              onClick={handleCopy}
              className='text-muted-foreground hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100'
              title={t('Copy')}
            >
              <Copy className='size-4' />
            </button>
          </div>

          <div className='mt-1 flex -translate-y-[6px] flex-nowrap items-baseline gap-x-2 text-sm whitespace-nowrap min-[480px]:gap-x-4'>
            {priceSummary}
          </div>
        </div>
      </div>

      <p className='mt-6 line-clamp-3 h-16 shrink-0 overflow-hidden text-sm leading-[21px] text-[#606060] dark:text-[#a3a3a3]'>
        {props.model.description || t('No description available.')}
      </p>

      <div className='mt-6 flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex h-4 min-w-0 items-center gap-x-2 overflow-hidden text-xs leading-4 font-medium whitespace-nowrap'>
            {primaryGroup ? (
              <span className='text-[#606060] dark:text-[#a3a3a3]'>
                {primaryGroup}
              </span>
            ) : null}
            <span className='text-[#33b1ff]'>
              {billingLabel(props.model, t)}
            </span>
          </div>
          {(bottomTags.length > 0 || hiddenCount > 0) && (
            <div className='flex h-4 min-w-0 items-center gap-x-2 overflow-hidden text-[12px] leading-4 font-light whitespace-nowrap text-[#919191] dark:text-[#77777a]'>
              {bottomTags.map((item) => (
                <span key={item} className='truncate'>
                  {item}
                </span>
              ))}
              {hiddenCount > 0 ? <span>+{hiddenCount}</span> : null}
            </div>
          )}
        </div>

        <ModelPerfBadge perf={props.perf} />
      </div>
    </div>
  )
})
