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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  recent_success_rates?: number[]
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value > 1 ? String(Math.round(value)) : value.toFixed(1)
}

function formatCompactLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms >= 1_000) return `${formatCompactNumber(ms / 1_000)}s`
  return `${formatCompactNumber(ms)}ms`
}

function formatCompactThroughput(tps: number): string {
  if (!Number.isFinite(tps) || tps <= 0) return '—'
  if (tps >= 1_000) return `${formatCompactNumber(tps / 1_000)}Kt`
  return `${formatCompactNumber(tps)}t`
}

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()

  if (!props.perf) {
    return null
  }

  const { avg_latency_ms, avg_tps, success_rate } = props.perf

  const recentRates =
    props.perf.recent_success_rates?.filter((rate) => Number.isFinite(rate)) ??
    []
  const statusRates =
    recentRates.length > 0 ? recentRates.slice(-3) : [success_rate]
  const statusBars = [
    ...Array(Math.max(0, 3 - statusRates.length)).fill(null),
    ...statusRates,
  ].slice(-3)

  return (
    <div
      className={cn(
        'flex shrink-0 items-end gap-4 text-left tabular-nums',
        props.className
      )}
    >
      <div title={t('Average latency')} className='min-w-0'>
        <div className='text-[12px] leading-4 font-light text-[#919191] dark:text-[#77777a]'>
          {t('Latency short')}
        </div>
        <div className='mt-2 text-[12px] leading-4 font-medium whitespace-nowrap text-[#606060] dark:text-[#a3a3a3]'>
          {formatCompactLatency(avg_latency_ms)}
        </div>
      </div>
      <div title={t('Throughput')} className='min-w-0'>
        <div className='text-[12px] leading-4 font-light text-[#919191] dark:text-[#77777a]'>
          {t('Throughput short')}
        </div>
        <div className='mt-2 text-[12px] leading-4 font-medium whitespace-nowrap text-[#606060] dark:text-[#a3a3a3]'>
          {formatCompactThroughput(avg_tps)}
        </div>
      </div>
      <div
        title={`${t('Success rate')}: ${success_rate.toFixed(1)}%`}
        className='min-w-0 text-center'
      >
        <div className='text-[12px] leading-4 font-light text-[#919191] dark:text-[#77777a]'>
          {t('Status short')}
        </div>
        <div className='mt-2 flex h-4 items-end justify-center gap-0.5 py-px'>
          {statusBars.map((rate, index) => (
            <span
              key={['earliest', 'middle', 'latest'][index]}
              className={cn(
                'w-1 rounded-full',
                index === 0 && 'h-2',
                index === 1 && 'h-2.5',
                index === 2 && 'h-3',
                rate == null
                  ? 'bg-[#c2c1c1] dark:bg-[#545454]'
                  : getSuccessRateDotClass(rate)
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
