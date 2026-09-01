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

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32 lg:py-40'>
      <div
        aria-hidden
        className='absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 55% 50% at 50% 50%, oklch(0.7 0.16 250 / 22%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 40% at 78% 35%, oklch(0.68 0.14 280 / 14%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <AnimateInView
        className='mx-auto max-w-3xl text-center'
        animation='scale-in'
      >
        <h2 className='text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-semibold tracking-tight'>
          {t('Ready to start?')}
        </h2>
        <p className='text-muted-foreground mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg'>
          {t(
            'One key for models — and an enterprise path with customers and workspaces.'
          )}
        </p>
        <div className='mt-10 flex flex-wrap items-center justify-center gap-3'>
          <Button
            className='group h-12 rounded-full px-8 text-sm font-semibold'
            render={<Link to='/sign-up' />}
          >
            {t('Get Started')}
            <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='border-[color:var(--landing-outline,#3a3a3a)] hover:bg-muted/50 h-12 rounded-full px-8 text-sm font-medium'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
