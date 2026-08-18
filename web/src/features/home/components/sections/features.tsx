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
import { ArrowUpRight, Code, ImageIcon, Video, Wallet } from 'lucide-react'
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
      icon: <Code className='size-4 text-blue-400' />,
      href: '/pricing' as const,
      action: t('Explore pricing'),
    },
    {
      id: 'image',
      title: t('Image Generation'),
      desc: t(
        'Generate images in the console after sign-in. Quota follows your account or workspace.'
      ),
      icon: <ImageIcon className='size-4 text-violet-400' />,
      href: '/experience/images' as const,
      action: t('Try image generation'),
    },
    {
      id: 'video',
      title: t('Video Generation'),
      desc: t(
        'Submit video jobs and preview results with the same account quota.'
      ),
      icon: <Video className='size-4 text-amber-400' />,
      href: '/experience/videos' as const,
      action: t('Try video generation'),
    },
    {
      id: 'pricing',
      title: t('Usage and pricing'),
      desc: t('See model prices before you integrate. Pay for what you use.'),
      icon: <Wallet className='size-4 text-emerald-400' />,
      href: '/pricing' as const,
      action: t('View Pricing'),
    },
  ]

  return (
    <section className='relative z-10 px-6 pt-24 pb-10 md:pt-32 md:pb-12'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-14 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Capabilities')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('What you can run today')}
          </h2>
        </AnimateInView>

        <div className='grid gap-3 sm:grid-cols-2'>
          {cards.map((card, i) => (
            <AnimateInView
              key={card.id}
              delay={i * 80}
              animation='scale-in'
              className='h-full'
            >
              <Link
                to={card.href}
                className='border-border/40 bg-muted/10 hover:bg-muted/20 group flex h-full flex-col rounded-xl border p-6 transition-colors md:p-7'
              >
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <span className='border-border/40 bg-background flex size-9 items-center justify-center rounded-lg border'>
                    {card.icon}
                  </span>
                  <ArrowUpRight className='text-muted-foreground/50 group-hover:text-foreground size-4 transition-colors' />
                </div>
                <h3 className='text-base font-semibold'>{card.title}</h3>
                <p className='text-muted-foreground mt-2 flex-1 text-sm leading-relaxed'>
                  {card.desc}
                </p>
                <span className='text-foreground/80 mt-5 text-sm font-medium'>
                  {card.action}
                </span>
              </Link>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView delay={200} className='mt-6 text-center'>
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
