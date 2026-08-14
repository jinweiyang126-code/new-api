/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { TFunction } from 'i18next'

/** Translate backend API message when a locale key exists; otherwise show as-is / fallback. */
export function apiErrorMessage(
  t: TFunction,
  message: string | null | undefined,
  fallbackKey: string
): string {
  const msg = (message || '').trim()
  if (!msg) return t(fallbackKey)
  return t(msg)
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
