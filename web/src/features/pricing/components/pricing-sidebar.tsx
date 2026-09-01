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
import {
  ChevronDown,
  RotateCcw,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  ENDPOINT_TYPES,
  FILTER_ALL,
  QUOTA_TYPES,
  getEndpointTypeLabels,
  getQuotaTypeLabels,
} from '../constants'
import { parseTags } from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'
import {
  FilterIconEndpointType,
  FilterIconGroups,
  FilterIconPricingType,
  FilterIconTags,
  FilterIconVendors,
} from './filter-section-icons'

type FilterOption = {
  value: string
  label: string
  count?: number
  suffix?: string
  icon?: ReactNode
}

type FilterSectionProps = {
  title: string
  icon?: ReactNode
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  defaultOpen?: boolean
  collapsedPreview?: number
}

export interface PricingSidebarProps {
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  tags: string[]
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

function countBy(
  models: PricingModel[],
  predicate: (model: PricingModel) => boolean
): number {
  return models.reduce((count, model) => count + (predicate(model) ? 1 : 0), 0)
}

function formatGroupRatio(ratio: number | undefined): string | undefined {
  if (ratio == null) return undefined
  const formatted = Number.isInteger(ratio)
    ? ratio.toString()
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `x${formatted}`
}

function FilterRow(props: {
  option: FilterOption
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-[5px] py-2 pr-2 pl-5 text-left transition-colors',
        props.active
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      )}
      title={props.option.label}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
          props.active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-[#dbdbdb] bg-[#fdfdfd] dark:border-border dark:bg-background'
        )}
        aria-hidden
      >
        {props.active ? (
          <svg
            viewBox='0 0 11 8'
            width='10'
            height='8'
            fill='none'
            aria-hidden
          >
            <path
              d='M9.90765 0.857143L3.68543 7.07937L0.857143 4.25108'
              stroke='currentColor'
              strokeWidth='1.71429'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        ) : null}
      </span>
      {props.option.icon ? (
        <span className='shrink-0'>{props.option.icon}</span>
      ) : null}
      <span
        className={cn(
          'min-w-0 truncate text-sm',
          props.active ? 'font-medium' : 'font-normal'
        )}
      >
        {props.option.label}
      </span>
      {(props.option.suffix || props.option.count != null) && (
        <span className='text-muted-foreground shrink-0 text-xs'>
          {props.option.suffix ?? props.option.count}
        </span>
      )}
    </button>
  )
}

function FilterSection(props: FilterSectionProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const preview = props.collapsedPreview ?? 0
  // Show all options when count is small (<=6); otherwise collapse to preview (default 4)
  const shouldCollapse =
    preview > 0 && props.options.length > Math.max(preview, 6)
  const needsMore = shouldCollapse && !expanded
  const visibleOptions = needsMore
    ? props.options.slice(0, preview)
    : props.options

  return (
    <Collapsible
      defaultOpen={props.defaultOpen ?? true}
      className='space-y-2'
    >
      <CollapsibleTrigger className='group flex w-full items-center justify-between gap-2 py-2 text-left'>
        <span className='text-foreground flex min-w-0 items-center gap-1 font-medium'>
          {props.icon}
          <span className='truncate text-sm'>{props.title}</span>
        </span>
        <ChevronDown className='text-muted-foreground size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180' />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='flex flex-col gap-1'>
          {visibleOptions.map((option) => (
            <FilterRow
              key={option.value}
              option={option}
              active={props.value === option.value}
              onClick={() => props.onChange(option.value)}
            />
          ))}
          {needsMore ? (
            <button
              type='button'
              onClick={() => setExpanded(true)}
              className='text-muted-foreground hover:text-foreground px-5 py-2 text-left text-sm'
            >
              {t('More...')}
            </button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PricingSidebar(props: PricingSidebarProps) {
  const { t } = useTranslation()
  const quotaTypeLabels = getQuotaTypeLabels(t)
  const endpointTypeLabels = getEndpointTypeLabels(t)

  const vendorOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Vendors'),
      count: props.models.length,
    },
    ...props.vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        count: countBy(
          props.models,
          (model) => model.vendor_name === vendor.name
        ),
        icon: vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined,
      }))
      .filter((vendor) => vendor.count > 0),
  ]

  const groupOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Groups'),
    },
    ...props.groups.map((group) => ({
      value: group,
      label: group,
      suffix: formatGroupRatio(props.groupRatios?.[group]),
    })),
  ]

  const quotaOptions: FilterOption[] = [
    {
      value: QUOTA_TYPES.ALL,
      label: quotaTypeLabels[QUOTA_TYPES.ALL],
      count: props.models.length,
    },
    {
      value: QUOTA_TYPES.TOKEN,
      label: quotaTypeLabels[QUOTA_TYPES.TOKEN],
      count: countBy(props.models, (model) => model.quota_type === 0),
    },
    {
      value: QUOTA_TYPES.REQUEST,
      label: quotaTypeLabels[QUOTA_TYPES.REQUEST],
      count: countBy(props.models, (model) => model.quota_type === 1),
    },
  ]

  const tagOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Tags'),
      count: props.models.length,
    },
    ...props.tags.map((tag) => ({
      value: tag,
      label: tag,
      count: countBy(props.models, (model) =>
        parseTags(model.tags)
          .map((item) => item.toLowerCase())
          .includes(tag.toLowerCase())
      ),
    })),
  ]

  const endpointOptions: FilterOption[] = [
    {
      value: ENDPOINT_TYPES.ALL,
      label: endpointTypeLabels[ENDPOINT_TYPES.ALL],
      count: props.models.length,
    },
    ...Object.entries(endpointTypeLabels)
      .filter(([value]) => value !== ENDPOINT_TYPES.ALL)
      .map(([value, label]) => ({
        value,
        label,
        count: countBy(
          props.models,
          (model) => model.supported_endpoint_types?.includes(value) ?? false
        ),
      })),
  ]

  return (
    <aside
      className={cn(
        'rounded-[20px] border border-[#e8e8e8] bg-white p-5 dark:border-border/80 dark:bg-transparent',
        props.className
      )}
    >
      <div className='mb-4 flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h2 className='text-foreground text-[15px] font-semibold'>
            {t('Filter')}
          </h2>
          <p className='text-muted-foreground mt-1 text-xs leading-snug'>
            {t('Refine models by provider, group, type, and tags.')}
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={props.onClearFilters}
          disabled={!props.hasActiveFilters}
          className='text-foreground h-auto shrink-0 gap-1 px-0 py-0 text-xs font-medium hover:bg-transparent'
        >
          <RotateCcw className='size-3' />
          {t('Reset')}
        </Button>
      </div>

      <div className='space-y-3'>
        <FilterSection
          title={t('Groups')}
          icon={<FilterIconGroups className='size-4' />}
          value={props.groupFilter}
          options={groupOptions}
          onChange={props.onGroupChange}
          collapsedPreview={4}
        />
        <FilterSection
          title={t('Vendors')}
          icon={<FilterIconVendors className='size-4' />}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
          collapsedPreview={4}
        />
        <FilterSection
          title={t('Model Tags')}
          icon={<FilterIconTags className='size-4' />}
          value={props.tagFilter}
          options={tagOptions}
          onChange={props.onTagChange}
          defaultOpen={false}
          collapsedPreview={4}
        />
        <FilterSection
          title={t('Pricing Type')}
          icon={<FilterIconPricingType className='size-4' />}
          value={props.quotaTypeFilter}
          options={quotaOptions}
          onChange={props.onQuotaTypeChange}
          defaultOpen={false}
          collapsedPreview={4}
        />
        <FilterSection
          title={t('Endpoint Type')}
          icon={<FilterIconEndpointType className='size-4' />}
          value={props.endpointTypeFilter}
          options={endpointOptions}
          onChange={props.onEndpointTypeChange}
          defaultOpen={false}
          collapsedPreview={4}
        />
      </div>
    </aside>
  )
}
