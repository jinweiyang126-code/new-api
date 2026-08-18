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
import { ArrowRight, Building2, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface EnterpriseProps {
  isAuthenticated?: boolean
}

export function Enterprise(props: EnterpriseProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-16 md:py-20'>
      <div className='border-border/40 bg-muted/10 mx-auto max-w-6xl overflow-hidden rounded-3xl border'>
        <div className='grid lg:grid-cols-12'>
          <div className='border-border/40 px-6 py-12 md:px-12 md:py-16 lg:col-span-5 lg:border-r'>
            <AnimateInView>
              <p className='text-muted-foreground mb-4 text-xs font-medium tracking-[0.18em] uppercase'>
                {t('Enterprise plan')}
              </p>
              <h2 className='text-[clamp(1.75rem,3vw,2.35rem)] leading-[1.15] font-semibold tracking-tight'>
                {t('Customers and workspaces')}
              </h2>
              <p className='text-muted-foreground mt-4 text-sm leading-relaxed'>
                {t(
                  'For companies that need isolation, shared budgets, and team collaboration.'
                )}
              </p>
            </AnimateInView>

            <AnimateInView delay={80} className='mt-10 space-y-4'>
              <div className='flex justify-center'>
                <div className='border-border/50 bg-background text-muted-foreground rounded-lg border px-4 py-2 text-xs font-medium tracking-wide uppercase'>
                  {t('Platform')}
                </div>
              </div>
              <div className='bg-border/60 mx-auto h-6 w-px' />
              <div className='flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3'>
                <Building2 className='mt-0.5 size-4 shrink-0 text-blue-400' />
                <div>
                  <p className='text-sm font-semibold'>{t('Customer')}</p>
                  <p className='text-muted-foreground mt-0.5 text-xs'>
                    {t('Contracted tenant · shared budget')}
                  </p>
                </div>
              </div>
              <div className='bg-border/60 mx-auto h-6 w-px' />
              <div className='grid grid-cols-2 gap-3'>
                {['A', 'B'].map((id) => (
                  <div
                    key={id}
                    className='border-border/50 bg-background flex items-start gap-2 rounded-xl border px-3 py-3'
                  >
                    <Layers className='text-muted-foreground mt-0.5 size-3.5 shrink-0' />
                    <div>
                      <p className='text-sm font-medium'>
                        {t('Workspace')} {id}
                      </p>
                      <p className='text-muted-foreground mt-0.5 text-[11px]'>
                        {t('Tokens and quota')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimateInView>
          </div>

          <div className='px-6 py-12 md:px-12 md:py-16 lg:col-span-7'>
            <div className='grid gap-6 sm:grid-cols-2'>
              <AnimateInView delay={120}>
                <h3 className='mb-2 flex items-center gap-2 text-sm font-semibold'>
                  <Building2 className='size-4 text-blue-400' />
                  {t('Customer')}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {t(
                    'A contracted tenant. We open the account and top up the pool. Customer admins create workspaces, invite members, and allocate quota. Optional dedicated upstream or BYOK.'
                  )}
                </p>
              </AnimateInView>
              <AnimateInView delay={180}>
                <h3 className='mb-2 flex items-center gap-2 text-sm font-semibold'>
                  <Layers className='text-muted-foreground size-4' />
                  {t('Workspace')}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {t(
                    'A business line or environment. Members issue workspace tokens. Calls deduct the workspace pool only — never the personal wallet.'
                  )}
                </p>
              </AnimateInView>
            </div>

            <AnimateInView delay={220} className='mt-8'>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'Personal accounts keep using individual quota until invited into a customer.'
                )}
              </p>
              <div className='mt-5'>
                {props.isAuthenticated ? (
                  <Button
                    className='group h-11 rounded-full px-6 text-sm font-semibold'
                    render={<Link to='/dashboard' />}
                  >
                    {t('Go to Dashboard')}
                    <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Button>
                ) : (
                  <Button
                    className='group h-11 rounded-full px-6 text-sm font-semibold'
                    render={<Link to='/sign-up' />}
                  >
                    {t('Get Started')}
                    <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Button>
                )}
              </div>
            </AnimateInView>
          </div>
        </div>
      </div>
    </section>
  )
}
