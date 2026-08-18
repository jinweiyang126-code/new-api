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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

import { HeroTerminalDemo } from '../hero-terminal-demo'

interface ShowcaseProps {
  isAuthenticated?: boolean
}

export function Showcase(props: ShowcaseProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-20 md:py-28 lg:py-32'>
      <div className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-12 lg:gap-16'>
        <AnimateInView className='lg:col-span-5'>
          <p className='text-muted-foreground mb-4 text-xs font-medium tracking-[0.18em] uppercase'>
            {t('OpenAI-compatible /v1')}
          </p>
          <h2 className='text-[clamp(1.85rem,3.6vw,2.85rem)] leading-[1.12] font-semibold tracking-tight'>
            {t('From key to first token')}
          </h2>
          <p className='text-muted-foreground mt-5 max-w-md text-base leading-relaxed md:text-[17px]'>
            {t(
              'Issue a token, then call chat, image, and video through one OpenAI-compatible endpoint — without changing your client.'
            )}
          </p>
          <div className='mt-8'>
            <Button
              className='group h-11 rounded-full px-6 text-sm font-semibold'
              render={
                <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
              }
            >
              {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          </div>
        </AnimateInView>

        <AnimateInView
          delay={120}
          animation='scale-in'
          className='lg:col-span-7'
        >
          <HeroTerminalDemo className='mt-0 max-w-none' />
        </AnimateInView>
      </div>
    </section>
  )
}
