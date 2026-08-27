/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { TFunction } from 'i18next'

import { formatQuota } from '@/lib/format'

/** Backend errors that append dynamic details after a fixed prefix. */
const ERROR_MESSAGE_PREFIX_KEYS = [
  'quota limit cannot be below occupied amount',
] as const

const QUOTA_MINIMUM_ERROR_RE =
  /^quota limit cannot be below occupied amount: minimum (\d+)$/

/** Translate backend API message when a locale key exists; otherwise show as-is / fallback. */
export function apiErrorMessage(
  t: TFunction,
  message: string | null | undefined,
  fallbackKey: string
): string {
  const msg = (message || '').trim()
  if (!msg) return t(fallbackKey)

  const minimumMatch = msg.match(QUOTA_MINIMUM_ERROR_RE)
  if (minimumMatch) {
    return t('Quota limit cannot be below occupied amount ({{min}})', {
      min: formatQuota(Number(minimumMatch[1])),
    })
  }

  const exact = t(msg)
  if (exact !== msg) return exact

  for (const prefix of ERROR_MESSAGE_PREFIX_KEYS) {
    if (!msg.startsWith(prefix)) continue
    const translatedPrefix = t(prefix)
    if (translatedPrefix !== prefix) {
      return translatedPrefix + msg.slice(prefix.length)
    }
  }

  return msg
}

export function roleLabel(t: TFunction, role: string): string {
  const keyByRole: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  }
  const key = keyByRole[(role || '').toLowerCase()]
  return key ? t(key) : role
}

export function invitationStatusLabel(t: TFunction, status: string): string {
  const keyByStatus: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    revoked: 'Revoked',
    expired: 'Expired',
  }
  const key = keyByStatus[(status || '').toLowerCase()]
  return key ? t(key) : status
}
