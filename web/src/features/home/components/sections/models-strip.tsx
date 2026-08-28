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
import { Box } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'

import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<{ size?: number; className?: string }>

type IconItem = {
  Icon: IconComponent
  label: string
  /** Desktop arc offset — higher = lower on curve */
  arc: 'high' | 'mid' | 'low'
  custom?: 'cursor'
}

const MODEL_ITEMS: IconItem[] = [
  { Icon: Qwen.Color ?? Qwen, label: 'Qwen', arc: 'low' },
  { Icon: Gemini.Color ?? Gemini, label: 'Gemini', arc: 'mid' },
  { Icon: Claude.Color ?? Claude, label: 'Claude', arc: 'high' },
  { Icon: OpenAI, label: 'OpenAI', arc: 'high' },
  { Icon: DeepSeek.Color ?? DeepSeek, label: 'DeepSeek', arc: 'mid' },
  { Icon: Doubao.Color ?? Doubao, label: 'Doubao', arc: 'low' },
]

const APP_ITEMS: IconItem[] = [
  { Icon: Github, label: 'GitHub Copilot', arc: 'low' },
  { Icon: Claude.Color ?? Claude, label: 'Claude Code', arc: 'mid' },
  { Icon: OpenAI, label: 'Cursor', arc: 'high', custom: 'cursor' },
  { Icon: OpenAI, label: 'Codex', arc: 'mid' },
  { Icon: Cline, label: 'Cline', arc: 'low' },
]

const ARC_CLASS: Record<IconItem['arc'], string> = {
  high: 'md:mt-0',
  mid: 'md:mt-4',
  low: 'md:mt-10',
}

function BrandTile(props: IconItem) {
  const Icon = props.Icon
  return (
    <div
      className={cn(
        'flex w-16 flex-col items-center gap-3 sm:w-[4.5rem]',
        ARC_CLASS[props.arc]
      )}
    >
      <div className='border-border bg-card flex size-14 items-center justify-center rounded-xl border sm:size-16'>
        {props.custom === 'cursor' ? (
          <Box className='text-foreground size-7' strokeWidth={1.5} />
        ) : (
          <Icon size={32} />
        )}
      </div>
      <p className='text-foreground text-center text-xs leading-snug sm:text-sm'>
        {props.label}
      </p>
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

      <div className='mx-auto max-w-5xl'>
        <AnimateInView className='mb-6 text-center md:mb-8'>
          <p className='text-muted-foreground mb-3 text-sm uppercase'>
            {t('Compatible models')}
          </p>
          <h2 className='text-foreground text-[clamp(1.75rem,4vw,2.875rem)] leading-tight font-semibold tracking-[-0.02em]'>
            {t('One protocol')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-md text-sm'>
            {t('Models from OpenAI, Claude, Gemini, DeepSeek, Qwen, and more')}
          </p>
        </AnimateInView>

        <AnimateInView
          delay={80}
          className='flex flex-wrap items-start justify-center gap-x-6 gap-y-8 sm:gap-x-10 md:gap-x-14'
        >
          {MODEL_ITEMS.map((item) => (
            <BrandTile key={item.label} {...item} />
          ))}
        </AnimateInView>

        <AnimateInView delay={140} className='mt-14 md:mt-16'>
          <p className='text-muted-foreground mb-8 text-center text-sm capitalize'>
            {t('Supported Applications')}
          </p>
          <div className='flex flex-wrap items-start justify-center gap-x-6 gap-y-8 sm:gap-x-10 md:gap-x-14'>
            {APP_ITEMS.map((item) => (
              <BrandTile key={item.label} {...item} />
            ))}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
