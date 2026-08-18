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
import { ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://api.example.com'
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Get Started')

  const renderDocsLink = () => {
    const isExternal = docsUrl.startsWith('http')
    const className =
      'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'
    const inner = (
      <>
        <BookOpen className='size-3.5' />
        <span>{t('Docs')}</span>
      </>
    )
    if (isExternal) {
      return (
        <a
          href={docsUrl}
          target='_blank'
          rel='noopener noreferrer'
          className={className}
        >
          {inner}
        </a>
      )
    }
    return (
      <Link to={docsUrl} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <section className='relative z-10 flex min-h-[min(92svh,920px)] flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-16 md:pt-32 md:pb-24'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 70% 55% at 50% -10%, oklch(0.72 0.18 250 / 28%) 0%, transparent 62%)',
            'radial-gradient(ellipse 50% 40% at 12% 70%, oklch(0.68 0.16 280 / 18%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 35% at 88% 55%, oklch(0.7 0.14 200 / 16%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_20%,black_15%,transparent_75%)] bg-[size:4.5rem_4.5rem] opacity-[0.07]'
      />

      <div className='mx-auto flex w-full max-w-5xl flex-col items-center text-center'>
        <p
          className='landing-animate-fade-up text-muted-foreground mb-6 text-[13px] font-medium tracking-[0.18em] uppercase opacity-0'
          style={{ animationDelay: '0ms' }}
        >
          {t('Connect. Route. Scale. Instantly.')}
        </p>

        <h1
          className='landing-animate-fade-up max-w-4xl text-[clamp(2.6rem,8vw,5.25rem)] leading-[1.04] font-semibold tracking-[-0.04em] opacity-0'
          style={{ animationDelay: '70ms' }}
        >
          {t('Unified API Gateway for')}
          <br />
          <span className='bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent'>
            {t('Vast Range of AI Models')}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed opacity-0 md:text-lg'
          style={{ animationDelay: '140ms' }}
        >
          {t(
            'Call chat, image, and video through a single OpenAI-compatible API.'
          )}
        </p>

        <div
          className='landing-animate-fade-up mt-10 w-full max-w-3xl opacity-0'
          style={{ animationDelay: '200ms' }}
        >
          <Link
            to={primaryTo}
            className='border-border/50 bg-background/70 group hover:border-border relative flex flex-col gap-4 rounded-[1.75rem] border p-2.5 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-[border-color,box-shadow] dark:bg-white/[0.04] dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.75)]'
          >
            <div className='bg-muted/40 flex min-h-[7.5rem] flex-col justify-between rounded-[1.35rem] px-5 py-4 text-left md:min-h-[8.25rem] md:px-6 md:py-5'>
              <div className='text-muted-foreground flex items-center gap-2.5 font-mono text-[11px] tracking-wide md:text-xs'>
                <span className='bg-foreground/8 rounded-md px-1.5 py-0.5 font-semibold text-sky-600 dark:text-sky-400'>
                  POST
                </span>
                <span className='truncate'>{origin}/v1/chat/completions</span>
              </div>
              <div className='mt-6 flex items-end justify-between gap-4'>
                <p className='text-muted-foreground/80 max-w-[18rem] text-sm leading-snug md:max-w-md md:text-[15px]'>
                  {t('One key. Chat, image, and video.')}
                </p>
                <span className='bg-foreground text-background inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5 group-hover:scale-105'>
                  <ArrowUpRight className='size-5' />
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div
          className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
          style={{ animationDelay: '260ms' }}
        >
          <Button
            className='group h-12 rounded-full px-7 text-sm font-semibold'
            render={<Link to={primaryTo} />}
          >
            {primaryLabel}
            <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          {!props.isAuthenticated && (
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 h-12 rounded-full px-7 text-sm font-medium'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          )}
          {renderDocsLink()}
        </div>
      </div>
    </section>
  )
}
