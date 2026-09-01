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
import { LANDING_LOGO_MARK_SRC } from '@/features/home/lib/landing-brand'

import {
  IconFeatureAccess,
  IconFeatureCost,
  IconFeatureReliability,
  IconFigmaCheckBadge,
  IconLayers,
  IconVerify,
} from '../landing-figma-icons'

interface EnterpriseProps {
  isAuthenticated?: boolean
}

const FEATURE_CARDS = [
  {
    icon: IconFeatureReliability,
    title: 'Enterprise Grade Reliability',
    bullets: [
      'Complete monitoring system for approved AI model traffic',
      'Operational monitoring, escalation policies, and uptime review',
      'Flexible capacity limits with customer-level throttling',
    ],
  },
  {
    icon: IconFeatureAccess,
    title: 'Access Controls for Every Customer',
    bullets: [
      'Per-customer budgets, model permissions, and workspace policies',
      'Rate limits, allowlists, prepaid balances, and approval workflows',
      'Operational support for onboarding, exceptions, and incident review',
    ],
  },
  {
    icon: IconFeatureCost,
    title: 'Cost Governance Without Chaos',
    bullets: [
      'Customer-level budgets, prepaid balances, and approval thresholds',
      'Usage ledgers that connect consumption to billing and settlement',
      'Cost review workflows that prevent runaway spend before it happens',
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
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-base'>
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
          </div>
        </AnimateInView>

        <AnimateInView delay={80}>
          <div className='border-border bg-card overflow-hidden rounded-[20px] border'>
            <div className='grid lg:grid-cols-12'>
              <div className='border-border flex flex-col items-center gap-5 px-6 py-10 md:px-10 lg:col-span-5 lg:border-r'>
                <div className='border-border bg-background flex size-[50px] items-center justify-center rounded-[12px] border p-3'>
                  <img
                    src={LANDING_LOGO_MARK_SRC}
                    alt=''
                    className='size-6 object-contain'
                    decoding='async'
                  />
                </div>
                <div className='bg-border h-8 w-px' />
                <div
                  className='flex w-full max-w-sm items-center gap-3 rounded-[12px] border px-4 py-3'
                  style={{
                    backgroundColor: 'var(--landing-org-bg)',
                    borderColor: 'var(--landing-org-border)',
                  }}
                >
                  <IconVerify className='size-5 shrink-0 text-[#33b1ff]' />
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
                      className='border-border bg-background flex items-center gap-2 rounded-[12px] border px-3 py-3'
                    >
                      <IconLayers className='text-muted-foreground size-4 shrink-0' />
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
                  <IconVerify className='mb-3 size-6 text-[#33b1ff]' />
                  <h3 className='text-foreground text-base font-semibold'>
                    {t('Organization')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-base leading-relaxed'>
                    {t(
                      'A contracted tenant. We open the account and top up the pool. Customer admins create workspaces, invite members, and allocate quota. Optional dedicated upstream or BYOK.'
                    )}
                  </p>
                </div>
                <div className='border-border border-t' />
                <div>
                  <IconLayers className='text-muted-foreground mb-3 size-6' />
                  <h3 className='text-foreground text-base font-semibold'>
                    {t('Workspace')}
                  </h3>
                  <p className='text-muted-foreground mt-2 text-base leading-relaxed'>
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
          <p className='text-muted-foreground mx-auto mt-4 max-w-3xl text-base leading-relaxed'>
            {t(
              'Take full control of your AI infrastructure with comprehensive traffic monitoring, proactive cost management, audit-ready compliance frameworks, and granular per-customer access policies.'
            )}
          </p>
        </AnimateInView>

        <div className='mt-10 grid gap-5 md:grid-cols-3'>
          {FEATURE_CARDS.map((card, index) => (
            <AnimateInView key={card.title} delay={140 + index * 60}>
              <div className='border-border bg-card flex h-full flex-col gap-6 rounded-[20px] border p-8'>
                <div className='bg-background flex size-12 items-center justify-center rounded-full border border-[#e8e8e8] dark:border-border'>
                  <card.icon className='text-muted-foreground size-5' />
                </div>
                <div>
                  <h3 className='text-foreground mb-6 text-lg font-medium capitalize'>
                    {t(card.title)}
                  </h3>
                  <ul className='space-y-6'>
                    {card.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className='text-muted-foreground flex gap-2 text-base leading-snug'
                      >
                        <IconFigmaCheckBadge className='mt-0.5 size-3.5 shrink-0 text-[#33b1ff]' />
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
