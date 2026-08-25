/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ReactNode } from 'react'

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

/** Prefer https icon URL; otherwise first letter of the provider name. */
export function renderOAuthProviderIcon(
  name: string,
  icon?: string | null,
  className = 'h-4 w-4'
): ReactNode {
  const safeUrl = normalizeHttpsIconUrl(icon)
  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt=''
        className={className}
        style={{ objectFit: 'contain' }}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }

  const letter = (name.trim().charAt(0) || '?').toUpperCase()
  return (
    <span
      className='bg-muted text-muted-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'
      aria-hidden
    >
      {letter}
    </span>
  )
}
