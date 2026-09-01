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
  ArrowUpRight,
  Code,
  ImageIcon,
  Shield,
  Video,
  Wallet,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { IMAGE_VIDEO_STUDIO_URL } from '@/features/experience/constants'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const cards = [
    {
      id: 'api',
      title: t('Unified API'),
      desc: t(
        'Issue a key and call OpenAI-compatible /v1 routes without changing your client.'
      ),
      icon: <Code className='size-5' strokeWidth={1.5} />,
      href: '/pricing' as const,
      action: t('Explore pricing'),
    },
    {
      id: 'image',
      title: t('Image Generation'),
      desc: t(
        'Generate images in the console after sign-in. Quota follows your account or workspace.'
      ),
      icon: <ImageIcon className='size-5' strokeWidth={1.5} />,
      href: '/experience/images' as const,
      action: t('Try image generation'),
    },
    {
      id: 'video',
      title: t('Video Generation'),
      desc: t(
        'Submit video jobs and preview results with the same account quota.'
      ),
      icon: <Video className='size-5' strokeWidth={1.5} />,
      href: '/experience/videos' as const,
      action: t('Try video generation'),
    },
    {
      id: 'speed',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
      icon: <Zap className='size-5' strokeWidth={1.5} />,
      href: '/pricing' as const,
      action: t('Explore pricing'),
    },
    {
      id: 'secure',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      icon: <Shield className='size-5' strokeWidth={1.5} />,
      href: '/pricing' as const,
      action: t('Explore pricing'),
    },
    {
      id: 'pricing',
      title: t('Usage and pricing'),
      desc: t('See model prices before you integrate. Pay for what you use.'),
      icon: <Wallet className='size-5' strokeWidth={1.5} />,
      href: '/pricing' as const,
      action: t('View Pricing'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-20 md:py-28 lg:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mx-auto mb-14 max-w-2xl text-center md:mb-16'>
          <p className='text-muted-foreground mb-4 text-xs font-medium tracking-[0.18em] uppercase'>
            {t('Capabilities')}
          </p>
          <h2 className='text-[clamp(1.85rem,3.6vw,2.85rem)] leading-[1.12] font-semibold tracking-tight'>
            {t('Key capabilities')}
          </h2>
          <p className='text-muted-foreground mt-4 text-base leading-relaxed md:text-[17px]'>
            {t('Route anything. Bill anything. Ship on one protocol.')}
          </p>
        </AnimateInView>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5'>
          {cards.map((card, i) => (
            <AnimateInView
              key={card.id}
              delay={i * 70}
              animation='scale-in'
              className='h-full'
            >
              <Link
                to={card.href}
                className='border-border bg-card hover:bg-muted/30 group flex h-full flex-col rounded-[20px] border p-7 transition-colors md:p-8'
              >
                <div className='mb-6 flex items-center justify-between gap-3'>
                  <span className='border-border bg-background text-muted-foreground flex size-11 items-center justify-center rounded-[12px] border'>
                    {card.icon}
                  </span>
                  <ArrowUpRight className='text-muted-foreground/40 group-hover:text-foreground size-4 transition-colors' />
                </div>
                <h3 className='text-lg font-semibold tracking-tight'>
                  {card.title}
                </h3>
                <p className='text-muted-foreground mt-2.5 flex-1 text-sm leading-relaxed'>
                  {card.desc}
                </p>
                <span className='text-foreground/80 mt-6 text-sm font-medium'>
                  {card.action}
                </span>
              </Link>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView delay={200} className='mt-10 text-center'>
          <a
            href={IMAGE_VIDEO_STUDIO_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'
          >
            {t('Image and video studio')}
            <ArrowUpRight className='size-3.5' />
          </a>
        </AnimateInView>
      </div>
    </section>
  )
}
