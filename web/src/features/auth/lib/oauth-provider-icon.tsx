/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ComponentType, ReactNode, SVGProps } from 'react'

import { cn } from '@/lib/utils'

import {
  IconDiscord,
  IconDocker,
  IconFacebook,
  IconFigma,
  IconGithub,
  IconGitlab,
  IconGmail,
  IconGoogle,
  IconLinuxDo,
  IconMedium,
  IconNotion,
  IconSkype,
  IconSlack,
  IconStripe,
  IconTelegram,
  IconTrello,
  IconWeChat,
  IconWhatsapp,
  IconZoom,
} from '@/assets/brand-icons'

type BrandIcon = ComponentType<SVGProps<SVGSVGElement>>

/** Figma `icon-quick login` is 18×18. Use `size-*` so Button's default size-4 does not win. */
export const OAUTH_ICON_SIZE_CLASS = 'size-[18px]'

const BRAND_ICONS: Record<string, BrandIcon> = {
  discord: IconDiscord,
  docker: IconDocker,
  facebook: IconFacebook,
  figma: IconFigma,
  github: IconGithub,
  gitlab: IconGitlab,
  gmail: IconGmail,
  google: IconGoogle,
  linuxdo: IconLinuxDo,
  medium: IconMedium,
  notion: IconNotion,
  skype: IconSkype,
  slack: IconSlack,
  stripe: IconStripe,
  telegram: IconTelegram,
  trello: IconTrello,
  wechat: IconWeChat,
  whatsapp: IconWhatsapp,
  zoom: IconZoom,
}

const BRAND_ALIASES: Record<string, string> = {
  'linux-do': 'linuxdo',
  weixin: 'wechat',
}

export type OAuthProviderIconSource = {
  name: string
  icon?: string | null
  slug?: string | null
}

export type OAuthProviderIconResolution =
  | { kind: 'url'; url: string }
  | { kind: 'brand'; key: string }
  | { kind: 'letter'; letter: string }

function normalizeHttpsIconUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  if (!/^https:\/\//i.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeBrandKey(raw: string): string {
  return raw.trim().toLowerCase().replaceAll(/[\s_]+/g, '-')
}

function lookupBrandKey(raw: string): string | null {
  const normalized = normalizeBrandKey(raw)
  if (!normalized) return null

  const aliased = BRAND_ALIASES[normalized] ?? normalized
  if (BRAND_ICONS[aliased]) return aliased

  for (const token of aliased.split('-')) {
    const tokenKey = BRAND_ALIASES[token] ?? token
    if (tokenKey && BRAND_ICONS[tokenKey]) return tokenKey
  }

  return null
}

/** HTTPS image, then built-in brand SVG (icon / slug / name), then letter avatar. */
export function resolveOAuthProviderIcon(
  source: OAuthProviderIconSource
): OAuthProviderIconResolution {
  const safeUrl = normalizeHttpsIconUrl(source.icon)
  if (safeUrl) return { kind: 'url', url: safeUrl }

  const iconKey = lookupBrandKey(source.icon ?? '')
  if (iconKey) return { kind: 'brand', key: iconKey }

  if (!source.icon?.trim()) {
    const inferred =
      lookupBrandKey(source.slug ?? '') ?? lookupBrandKey(source.name)
    if (inferred) return { kind: 'brand', key: inferred }
  }

  const letter = (source.name.trim().charAt(0) || '?').toUpperCase()
  return { kind: 'letter', letter }
}

export function renderOAuthProviderIcon(
  source: OAuthProviderIconSource,
  className = OAUTH_ICON_SIZE_CLASS
): ReactNode {
  const resolved = resolveOAuthProviderIcon(source)

  if (resolved.kind === 'url') {
    return (
      <img
        src={resolved.url}
        alt=''
        className={className}
        style={{ objectFit: 'contain' }}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }

  if (resolved.kind === 'brand') {
    const BrandIcon = BRAND_ICONS[resolved.key]
    return BrandIcon ? <BrandIcon className={className} aria-hidden /> : null
  }

  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        className
      )}
      aria-hidden
    >
      {resolved.letter}
    </span>
  )
}
