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
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import {
  LANDING_BRAND_NAME,
  LANDING_LOGO_LIGHT_SRC,
  LANDING_LOGO_SRC,
} from '@/features/home/lib/landing-brand'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO, DEFAULT_SYSTEM_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface FooterLink {
  text: string
  href: string
  onClick?: () => void
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

interface FooterProps {
  logo?: string
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  className?: string
  /** Figma Home–aligned compact footer (brand + link rows). */
  variant?: 'default' | 'landing'
  onContactClick?: () => void
}

function FooterLinkItem(props: { link: FooterLink; className?: string }) {
  const { t } = useTranslation()
  const label = t(props.link.text)
  const className = cn(
    'text-muted-foreground hover:text-foreground text-sm transition-colors duration-200',
    props.className
  )

  if (props.link.onClick) {
    return (
      <button type='button' onClick={props.link.onClick} className={className}>
        {label}
      </button>
    )
  }

  const isExternal =
    props.link.href.startsWith('http') ||
    props.link.href.startsWith('mailto:') ||
    props.link.href.startsWith('tel:')
  if (isExternal) {
    return (
      <a
        href={props.link.href}
        {...(props.link.href.startsWith('http')
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className={className}
      >
        {label}
      </a>
    )
  }

  return (
    <Link to={props.link.href} className={className}>
      {label}
    </Link>
  )
}

function LegalLinks(props: {
  leadingSeparator?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const items: { key: string; label: string; href: string }[] = []
  if (status?.user_agreement_enabled) {
    items.push({
      key: 'user-agreement',
      label: t('User Agreement'),
      href: '/user-agreement',
    })
  }
  if (status?.privacy_policy_enabled) {
    items.push({
      key: 'privacy-policy',
      label: t('Privacy Policy'),
      href: '/privacy-policy',
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {(props.leadingSeparator || index > 0) && (
            <span aria-hidden='true' className='text-muted-foreground/30'>
              ·
            </span>
          )}
          <Link
            to={item.href}
            className={cn(
              'hover:text-foreground transition-colors duration-200',
              props.className
            )}
          >
            {item.label}
          </Link>
        </Fragment>
      ))}
    </>
  )
}

function LandingFooter(props: FooterProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { systemName, logo: systemLogo, footerHtml } = useSystemConfig()

  const displayName = props.name || systemName || LANDING_BRAND_NAME
  const usingDefaultLogo = !systemLogo || systemLogo === DEFAULT_LOGO
  const defaultLandingLogo =
    resolvedTheme === 'light' ? LANDING_LOGO_LIGHT_SRC : LANDING_LOGO_SRC
  const brandLogo =
    props.logo || (usingDefaultLogo ? defaultLandingLogo : systemLogo)
  const currentYear = new Date().getFullYear()

  const navLinkClass =
    'text-muted-foreground hover:text-foreground text-[14px] leading-[18px] transition-colors duration-200'
  const legalLinkClass =
    'text-[14px] leading-[18px] text-[#696969] transition-colors duration-200 hover:text-[#696969]/hover:opacity-80'

  const topLinks: FooterLink[] = [
    { text: 'Console', href: '/dashboard' },
    { text: 'Model Square', href: '/pricing' },
    { text: 'Rankings', href: '/rankings' },
  ]

  const bottomLinks: FooterLink[] = [
    props.onContactClick
      ? {
          text: 'Contact Us',
          href: '#contact',
          onClick: props.onContactClick,
        }
      : { text: 'Contact Us', href: 'mailto:support@unionmeta.com' },
    { text: 'Terms of Service', href: '/user-agreement' },
    { text: 'Privacy Policy', href: '/privacy-policy' },
  ]

  if (footerHtml) {
    return (
      <footer className={cn('relative z-10', props.className)}>
        <div className='mx-auto w-full max-w-[1200px] px-6 py-8'>
          <div
            className='custom-footer text-muted-foreground text-sm'
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
        </div>
      </footer>
    )
  }

  return (
    <footer className={cn('relative z-10', props.className)}>
      <div className='mx-auto max-w-[1200px] px-6 pt-16 pb-16 md:pt-[100px] md:pb-[100px]'>
        <div className='grid gap-x-8 gap-y-4 md:grid-cols-[1fr_auto] md:items-center'>
          <Link to='/' className='inline-flex h-10 items-center md:col-start-1 md:row-start-1'>
            <img
              src={brandLogo}
              alt={displayName}
              className='h-8 w-auto max-w-[220px] object-contain object-left'
              decoding='async'
            />
          </Link>
          <p className='text-muted-foreground text-[16px] leading-[18px] md:col-start-1 md:row-start-2'>
            {t('One gateway to global AI')}
          </p>
          <nav
            aria-label={t('Footer')}
            className='flex flex-wrap items-center gap-x-8 gap-y-3 md:col-start-2 md:row-start-2 md:justify-end'
          >
            {topLinks.map((link) => (
              <FooterLinkItem
                key={link.text}
                link={link}
                className={navLinkClass}
              />
            ))}
          </nav>
        </div>

        <div className='mt-10 h-px w-full bg-border opacity-70' />

        <div className='mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-[14px] leading-[18px] text-[#696969]'>
            &copy; {currentYear} {displayName}.{' '}
            {props.copyright ?? t('footer.defaultCopyright')}
          </p>
          <nav
            aria-label={t('Legal')}
            className='flex flex-wrap items-center gap-x-6 gap-y-2 sm:justify-end'
          >
            {bottomLinks.map((link) => (
              <FooterLinkItem
                key={link.text}
                link={link}
                className={legalLinkClass}
              />
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const {
    systemName,
    logo: systemLogo,
    footerHtml,
    demoSiteEnabled,
  } = useSystemConfig()

  const displayLogo = systemLogo || props.logo || DEFAULT_LOGO
  const displayName = systemName || props.name || DEFAULT_SYSTEM_NAME
  const isDemoSiteMode = Boolean(demoSiteEnabled)
  const currentYear = new Date().getFullYear()

  const fallbackColumns = useMemo<FooterColumnProps[]>(
    () => [
      {
        title: t('footer.columns.about.title'),
        links: [
          {
            text: t('footer.columns.about.links.aboutProject'),
            href: 'https://docs.newapi.pro/wiki/project-introduction/',
          },
          {
            text: t('footer.columns.about.links.contact'),
            href: 'https://docs.newapi.pro/support/community-interaction/',
          },
          {
            text: t('footer.columns.about.links.features'),
            href: 'https://docs.newapi.pro/wiki/features-introduction/',
          },
        ],
      },
      {
        title: t('footer.columns.docs.title'),
        links: [
          {
            text: t('footer.columns.docs.links.quickStart'),
            href: 'https://docs.newapi.pro/getting-started/',
          },
          {
            text: t('footer.columns.docs.links.installation'),
            href: 'https://docs.newapi.pro/installation/',
          },
          {
            text: t('footer.columns.docs.links.apiDocs'),
            href: 'https://docs.newapi.pro/api/',
          },
        ],
      },
      {
        title: t('footer.columns.related.title'),
        links: [
          {
            text: t('footer.columns.related.links.oneApi'),
            href: 'https://github.com/songquanpeng/one-api',
          },
          {
            text: t('footer.columns.related.links.midjourney'),
            href: 'https://github.com/novicezk/midjourney-proxy',
          },
          {
            text: t('footer.columns.related.links.newApiKeyTool'),
            href: 'https://github.com/Calcium-Ion/new-api-key-tool',
          },
        ],
      },
    ],
    [t]
  )

  const displayColumns = props.columns ?? fallbackColumns

  if (props.variant === 'landing') {
    return <LandingFooter {...props} />
  }

  if (footerHtml) {
    return (
      <footer
        className={cn(
          'border-border/40 relative z-10 border-t',
          props.className
        )}
      >
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <div className='border-border/60 text-muted-foreground/45 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'>
              <LegalLinks />
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-border/40 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto max-w-6xl px-6 py-16 md:py-20'>
        <div className='flex flex-col justify-between gap-10 md:flex-row md:gap-16'>
          <div className='shrink-0'>
            <Link to='/' className='group flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={displayName}
                className='size-7 rounded-lg object-contain'
              />
              <span className='text-base font-semibold tracking-tight'>
                {displayName}
              </span>
            </Link>
            <p className='text-muted-foreground/70 mt-4 max-w-[240px] text-sm leading-relaxed'>
              {t('One gateway to global AI')}
            </p>
          </div>

          {isDemoSiteMode && (
            <div className='grid grid-cols-3 gap-8 md:gap-16'>
              {displayColumns.map((column, index) => (
                <div key={index}>
                  <p className='text-muted-foreground/50 mb-3 text-xs font-medium tracking-wider uppercase'>
                    {t(column.title)}
                  </p>
                  <ul className='space-y-2.5'>
                    {column.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <FooterLinkItem link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='border-border/30 text-muted-foreground/40 mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-6 text-xs sm:justify-start'>
          <span>
            &copy; {currentYear} {displayName}.{' '}
            {props.copyright ?? t('footer.defaultCopyright')}
          </span>
          <LegalLinks leadingSeparator />
        </div>
      </div>
    </footer>
  )
}
