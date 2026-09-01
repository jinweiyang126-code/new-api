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
import Claude from '@lobehub/icons/es/Claude'
import Cline from '@lobehub/icons/es/Cline'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Doubao from '@lobehub/icons/es/Doubao'
import Gemini from '@lobehub/icons/es/Gemini'
import Github from '@lobehub/icons/es/Github'
import OpenAI from '@lobehub/icons/es/OpenAI'
import Qwen from '@lobehub/icons/es/Qwen'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'

import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'

import { IconCursorCube } from '../landing-figma-icons'

type IconComponent = ComponentType<{ size?: number; className?: string }>

type IconItem = {
  Icon: IconComponent
  label: string
  /** Figma arc offset from the highest tile in the row */
  offsetY: number
  custom?: 'cursor'
}

/** Figma Hero Compatible models — tops 348 / 366 / 399 → offsets 0 / 18 / 51 */
const MODEL_ITEMS: IconItem[] = [
  { Icon: Qwen.Color ?? Qwen, label: 'Qwen', offsetY: 51 },
  { Icon: Gemini.Color ?? Gemini, label: 'Gemini', offsetY: 18 },
  { Icon: Claude.Color ?? Claude, label: 'Claude', offsetY: 0 },
  { Icon: OpenAI, label: 'OpenAI', offsetY: 0 },
  { Icon: DeepSeek.Color ?? DeepSeek, label: 'DeepSeek', offsetY: 18 },
  { Icon: Doubao.Color ?? Doubao, label: 'Doubao', offsetY: 51 },
]

/** Figma apps — tops 594 / 603 / 629 → offsets 0 / 9 / 35 */
const APP_ITEMS: IconItem[] = [
  { Icon: Github, label: 'GitHub Copilot', offsetY: 35 },
  { Icon: Claude.Color ?? Claude, label: 'Claude Code', offsetY: 9 },
  { Icon: OpenAI, label: 'Cursor', offsetY: 0, custom: 'cursor' },
  { Icon: OpenAI, label: 'Codex', offsetY: 9 },
  { Icon: Cline, label: 'Cline', offsetY: 35 },
]

const TILE = 64
/** Figma spacing between tile left edges is 184 → gap = 120 */
const TILE_GAP = 120
/** How far the dashed arc continues past the end icons (bezier t). Keep short to avoid scroll. */
const ARC_OVERSHOOT_T = 0.05

function quadPoint(
  t: number,
  p0: { x: number; y: number },
  c: { x: number; y: number },
  p2: { x: number; y: number }
) {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p2.y,
  }
}

/** Smooth Figma arc through end-icon centers, extended past both sides. */
function figmaArcPath(args: {
  p0: { x: number; y: number }
  p2: { x: number; y: number }
  peakY: number
}) {
  const c = {
    x: (args.p0.x + args.p2.x) / 2,
    y: 2 * args.peakY - args.p0.y,
  }
  const t0 = -ARC_OVERSHOOT_T
  const t1 = 1 + ARC_OVERSHOOT_T
  const steps = 24
  const parts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    const p = quadPoint(t, args.p0, c, args.p2)
    parts.push(`${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
  }
  const start = quadPoint(t0, args.p0, c, args.p2)
  const end = quadPoint(t1, args.p0, c, args.p2)
  return { d: parts.join(' '), start, end }
}

function BrandTile(props: IconItem) {
  const Icon = props.Icon
  return (
    <div
      className='flex w-16 shrink-0 flex-col items-center gap-4'
      style={{ transform: `translateY(${props.offsetY}px)` }}
    >
      <div
        className={cn(
          'bg-card relative z-[1] flex size-16 items-center justify-center rounded-[12px] border',
          'border-[color:var(--border)] shadow-[var(--landing-tile-shadow)]'
        )}
      >
        {props.custom === 'cursor' ? (
          <IconCursorCube className='text-foreground size-7' />
        ) : (
          <Icon size={32} />
        )}
      </div>
      <p className='text-foreground relative z-[1] text-center text-base leading-none whitespace-nowrap'>
        {props.label}
      </p>
    </div>
  )
}

function BrandArc(props: {
  items: IconItem[]
  className?: string
  /** Extra bottom padding so translateY tiles aren't clipped */
  padBottom: number
}) {
  const maxOffset = Math.max(...props.items.map((item) => item.offsetY), 0)
  const minOffset = Math.min(...props.items.map((item) => item.offsetY), 0)
  const width =
    props.items.length * TILE + Math.max(props.items.length - 1, 0) * TILE_GAP

  const p0 = { x: TILE / 2, y: maxOffset + TILE / 2 }
  const p2 = { x: width - TILE / 2, y: maxOffset + TILE / 2 }
  const peakY = minOffset + TILE / 2
  const { d, start, end } = figmaArcPath({ p0, p2, peakY })

  const svgLeft = Math.min(0, start.x)
  const svgRight = Math.max(width, end.x)
  const svgWidth = svgRight - svgLeft
  const svgTop = Math.min(0, start.y, end.y, peakY)
  const svgBottom = Math.max(TILE + maxOffset, start.y, end.y) + 1
  const svgHeight = svgBottom - svgTop

  return (
    <div
      className={cn('relative mx-auto', props.className)}
      style={{ width, paddingBottom: props.padBottom }}
    >
      <svg
        aria-hidden
        className='pointer-events-none absolute overflow-visible'
        style={{ left: svgLeft, top: svgTop, width: svgWidth, height: svgHeight }}
        width={svgWidth}
        height={svgHeight}
        viewBox={`${svgLeft} ${svgTop} ${svgWidth} ${svgHeight}`}
        fill='none'
      >
        <path
          d={d}
          stroke='var(--border)'
          strokeWidth={1}
          strokeDasharray='3 5'
          strokeLinecap='butt'
        />
      </svg>
      <div className='relative flex flex-nowrap items-start justify-center gap-[120px]'>
        {props.items.map((item) => (
          <BrandTile key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}

export function ModelsStrip() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 overflow-hidden px-6 py-16 md:py-24'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-[60%] max-w-5xl rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(123,80,227,0.08),transparent_70%)]'
      />

      <div className='mx-auto max-w-[1200px]'>
        <AnimateInView className='mb-10 text-center md:mb-12'>
          <p className='text-muted-foreground mb-4 text-sm uppercase'>
            {t('Compatible models')}
          </p>
          <h2 className='text-foreground text-[clamp(1.75rem,4vw,46px)] leading-[1.13] font-semibold tracking-[-0.02em]'>
            {t('One protocol')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-5 max-w-[488px] text-base whitespace-nowrap max-sm:whitespace-normal'>
            {t('Models from OpenAI, Claude, Gemini, DeepSeek, Qwen, and more')}
          </p>
        </AnimateInView>

        <AnimateInView delay={80} className='overflow-x-hidden pb-2'>
          <BrandArc items={MODEL_ITEMS} padBottom={51} />
        </AnimateInView>

        <AnimateInView delay={140} className='mt-14 md:mt-16'>
          <p className='text-muted-foreground mb-10 text-center text-sm capitalize'>
            {t('Supported Applications')}
          </p>
          <div className='overflow-x-hidden pb-2'>
            <BrandArc items={APP_ITEMS} padBottom={35} />
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
