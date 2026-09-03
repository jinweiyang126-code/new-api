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
import { cn } from '@/lib/utils'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Get Started')

  return (
    <section
      className={cn(
        'relative z-10 flex min-h-[480px] items-center justify-center overflow-hidden px-6 py-24 md:min-h-[640px] md:py-0',
        props.className
      )}
    >
      {/* Figma Ready to start — bottom teal / purple glow */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 70% 55% at 5% 100%, rgba(0, 189, 255, 0.22) 0%, transparent 65%)',
            'radial-gradient(ellipse 70% 55% at 45% 105%, rgba(123, 80, 227, 0.28) 0%, transparent 65%)',
            'radial-gradient(ellipse 70% 55% at 85% 110%, rgba(0, 189, 255, 0.18) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      <AnimateInView
        className='mx-auto w-full max-w-[671px] text-center'
        animation='scale-in'
      >
        <h2 className='text-foreground text-[clamp(2rem,5vw,56px)] leading-[1.08] font-semibold tracking-tight'>
          {t('Ready to start?')}
        </h2>
        <p className='text-muted-foreground mx-auto mt-6 text-base leading-relaxed md:mt-6 md:text-lg md:leading-[1.4]'>
          {t(
            'One key for models — and an enterprise path with organizations and workspaces.'
          )}
        </p>
        <div className='mt-12 flex flex-wrap items-center justify-center gap-5'>
          <Button
            className='group bg-primary text-primary-foreground hover:bg-primary/90 h-14 min-w-[200px] rounded-full px-6 text-lg font-normal'
            render={<Link to={primaryTo} />}
          >
            {primaryLabel}
            <ArrowRight className='ml-1 size-[22px] transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='border-[#CDCDCD] text-foreground hover:bg-muted/40 h-14 w-[200px] rounded-full px-6 text-lg font-normal dark:border-[#383838]'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
