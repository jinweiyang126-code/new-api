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

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getDefaultStats } from '../../constants'
import { StatCounter } from '../stat-counter'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const stats = getDefaultStats(t)
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Get Started')

  return (
    <section
      className={cn(
        'relative z-10 flex min-h-svh flex-col items-center justify-center overflow-hidden px-6',
        props.className
      )}
    >
      <div aria-hidden className='landing-glow pointer-events-none absolute inset-0 -z-10' />

      <div className='mx-auto flex w-full max-w-[1200px] flex-col items-center text-center'>
        <p
          className='landing-animate-fade-up text-muted-foreground mb-5 text-sm leading-[26px] opacity-0'
          style={{ animationDelay: '0ms' }}
        >
          {t('Connect. Route. Scale. Instantly.')}
        </p>

        <h1
          className='landing-animate-fade-up text-[clamp(1.75rem,calc((100vw-3rem)/14.5),72px)] leading-[1.08] font-bold tracking-tight capitalize opacity-0'
          style={{ animationDelay: '70ms' }}
        >
          <span className='text-foreground block whitespace-nowrap'>
            {t('One Gateway to Global AI')}
          </span>
          <span className='landing-hero-gradient mt-1 inline-block whitespace-nowrap px-[0.08em]'>
            {t('Better Models & Better Prices')}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-muted-foreground mt-10 max-w-3xl text-base leading-relaxed tracking-[-0.01em] opacity-0 md:text-2xl md:leading-8 md:whitespace-nowrap'
          style={{ animationDelay: '140ms' }}
        >
          {t(
            'Call chat, image, and video through a single OpenAI-compatible API.'
          )}
        </p>

        <div
          className='landing-animate-fade-up mt-[68px] flex flex-row flex-nowrap items-center justify-center gap-5 opacity-0'
          style={{ animationDelay: '200ms' }}
        >
          <Button
            className='group bg-primary text-primary-foreground hover:bg-primary/90 h-14 shrink-0 rounded-full px-[40px] text-lg font-normal'
            render={<Link to={primaryTo} />}
          >
            {primaryLabel}
            <ArrowRight className='ml-1 size-[22px] transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          {!props.isAuthenticated && (
            <Button
              variant='outline'
              className='border-[#CDCDCD] text-foreground hover:bg-muted/40 h-14 shrink-0 rounded-full px-[40px] text-lg font-normal'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          )}
        </div>

        <div
          className='landing-animate-fade-up mt-[132px] grid w-full max-w-4xl grid-cols-2 gap-8 opacity-0 md:grid-cols-4 md:gap-10'
          style={{ animationDelay: '280ms' }}
        >
          {stats.map((stat) => (
            <div key={stat.description} className='text-center'>
              <p className='text-foreground text-[clamp(1.75rem,4vw,2.875rem)] leading-tight font-semibold tracking-[-0.02em]'>
                <StatCounter end={stat.end} suffix={stat.suffix} />
              </p>
              <p className='text-muted-foreground mt-1 text-xs leading-[22px] md:text-sm'>
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
