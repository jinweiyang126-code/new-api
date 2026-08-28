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
import {
  ArrowRight,
  Building2,
  Check,
  Layers,
  Shield,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface EnterpriseProps {
  isAuthenticated?: boolean
  onContactClick?: () => void
}

const FEATURE_CARDS = [
  {
    icon: Shield,
    title: 'Enterprise Grade Reliability',
    bullets: [
      'Complete monitoring system for approved AI model traffic',
      'Operational monitoring, escalation policies, and uptime review',
      'Flexible capacity limits with customer-level throttling',
    ],
  },
  {
    icon: Wallet,
    title: 'Cost Governance Without Chaos',
    bullets: [
      'Customer-level budgets, prepaid balances, and approval thresholds',
      'Usage ledgers that connect consumption to billing and settlement',
      'Cost review workflows that prevent runaway spend before it happens',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Access Controls for Every Customer',
    bullets: [
      'Per-customer budgets, model permissions, and workspace policies',
      'Rate limits, allowlists, prepaid balances, and approval workflows',
      'Operational support for onboarding, exceptions, and incident review',
    ],
  },
] as const

export function Enterprise(props: EnterpriseProps) {
  const { t } = useTranslation()
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Create enterprise account')

  return (
    <section className='relative z-10 px-6 py-16 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-8 text-center md:mb-10'>
          <p className='text-muted-foreground mb-3 text-sm uppercase'>
            {t('Enterprise plan')}
          </p>
          <h2 className='text-foreground text-[clamp(1.75rem,4vw,2.875rem)] leading-tight font-semibold tracking-[-0.02em]'>
            {t('Customers and workspaces')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-xl'>
            {t(
              'For companies that need isolation, shared budgets, and team collaboration.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-full px-8 text-base font-semibold sm:h-14 sm:text-lg'
              render={<Link to={primaryTo} />}
            >
              {primaryLabel}
              <ArrowRight className='ml-1.5 size-5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            {props.onContactClick ? (
              <Button
                variant='outline'
                className='border-border text-foreground hover:bg-muted/40 h-12 rounded-full px-8 text-base font-semibold sm:h-14 sm:text-lg'
                onClick={props.onContactClick}
              >
                {t('Get in Touch')}
              </Button>
            ) : null}
          </div>
        </AnimateInView>

        <AnimateInView delay={80}>
          <div className='border-border bg-card overflow-hidden rounded-[20px] border'>
            <div className='grid lg:grid-cols-12'>
              <div className='border-border flex flex-col items-center gap-5 px-6 py-10 md:px-10 lg:col-span-5 lg:border-r'>
                <div className='border-border bg-background flex size-[50px] items-center justify-center rounded-xl border'>
                  <Building2 className='text-primary size-6' />
                </div>
                <div className='bg-border h-8 w-px' />
                <div className='border-border bg-card flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3'>
                  <ShieldCheck className='text-primary size-5 shrink-0' />
                  <div>
                    <p className='text-foreground text-sm font-semibold'>
                      {t('Organization')}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {t('Contracted tenant · shared budget')}
                    </p>
                  </div>
                </div>
                <div className='bg-border h-8 w-px' />
                <div className='grid w-full max-w-sm grid-cols-2 gap-3'>
                  {['A', 'B'].map((id) => (
                    <div
                      key={id}
                      className='border-border bg-background flex items-center gap-2 rounded-xl border px-3 py-3'
                    >
                      <Layers className='text-muted-foreground size-4 shrink-0' />
                      <div>
                        <p className='text-foreground text-sm font-semibold'>
                          {t('Workspace')} {id}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {t('Tokens and quota')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className='flex flex-col justify-center gap-8 px-6 py-10 md:px-10 lg:col-span-7'>
                <div>
                  <ShieldCheck className='mb-3 size-6 text-sky-400' />
                  <h3 className='text-foreground text-base font-semibold'>
                    {t('Organization')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                    {t(
                      'A contracted tenant. We open the account and top up the pool. Customer admins create workspaces, invite members, and allocate quota. Optional dedicated upstream or BYOK.'
                    )}
                  </p>
                </div>
                <div className='border-border border-t' />
                <div>
                  <Layers className='text-muted-foreground mb-3 size-6' />
                  <h3 className='text-foreground text-base font-semibold'>
                    {t('Workspace')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                    {t(
                      'A business line or environment. Members issue workspace tokens. Calls deduct the workspace pool only — never the personal wallet.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={120} className='mt-16 text-center md:mt-20'>
          <h2 className='text-foreground mx-auto max-w-2xl text-[clamp(1.75rem,4vw,2.875rem)] leading-tight font-semibold tracking-[-0.02em]'>
            {t('Enterprise-grade AI governance & control')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-3xl text-sm leading-relaxed md:text-base'>
            {t(
              'Take full control of your AI infrastructure with comprehensive traffic monitoring, proactive cost management, audit-ready compliance frameworks, and granular per-customer access policies.'
            )}
          </p>
        </AnimateInView>

        <div className='mt-10 grid gap-5 md:grid-cols-3'>
          {FEATURE_CARDS.map((card, index) => (
            <AnimateInView key={card.title} delay={140 + index * 60}>
              <div className='border-border bg-card flex h-full flex-col gap-6 rounded-[20px] border p-8'>
                <div className='border-border bg-background flex size-12 items-center justify-center rounded-full border'>
                  <card.icon className='text-foreground size-5' />
                </div>
                <div>
                  <h3 className='text-foreground mb-6 text-lg font-medium capitalize'>
                    {t(card.title)}
                  </h3>
                  <ul className='space-y-6'>
                    {card.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className='text-muted-foreground flex gap-2 text-sm leading-snug'
                      >
                        <Check className='mt-0.5 size-3.5 shrink-0 text-sky-400' />
                        <span>{t(bullet)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
