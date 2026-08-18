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
import { CherryStudio } from '@lobehub/icons'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { getLobeIcon } from '@/lib/lobe-icon'

import { AI_APPLICATIONS, AI_MODELS } from '../../constants'

function modelLabel(iconName: string) {
  return iconName.replace(/\.Color$/, '')
}

export function ModelsStrip() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-16 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 text-center'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-[0.18em] uppercase'>
            {t('Compatible models')}
          </p>
          <h2 className='text-xl font-semibold tracking-tight md:text-2xl'>
            {t(
              'One protocol. Models from OpenAI, Claude, Gemini, DeepSeek, Qwen, and more.'
            )}
          </h2>
        </AnimateInView>

        <AnimateInView
          delay={80}
          className='flex flex-wrap items-center justify-center gap-3'
        >
          {AI_MODELS.map((iconName) => (
            <div
              key={iconName}
              className='border-border/40 bg-muted/15 text-foreground/85 flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm'
            >
              {getLobeIcon(iconName, 22)}
              <span>{modelLabel(iconName)}</span>
            </div>
          ))}
        </AnimateInView>

        <AnimateInView delay={140} className='mt-10'>
          <p className='text-muted-foreground/50 mb-4 text-center text-[11px] font-medium tracking-[0.16em] uppercase'>
            {t('Supported Applications')}
          </p>
          <div className='flex flex-wrap items-center justify-center gap-3'>
            <a
              href='https://cherry-ai.com'
              target='_blank'
              rel='noopener noreferrer'
              className='border-border/40 bg-muted/15 text-foreground/80 hover:border-border hover:bg-muted/30 hover:text-foreground flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors'
            >
              <CherryStudio.Color size={20} className='shrink-0' />
              <span>Cherry Studio</span>
            </a>
            {AI_APPLICATIONS.map((name) => (
              <div
                key={name}
                className='border-border/40 bg-muted/15 text-foreground/70 flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm'
              >
                {getLobeIcon(name, 20)}
                <span>{modelLabel(name)}</span>
              </div>
            ))}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
