/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { TFunction } from 'i18next'

export const CUSTOMER_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
} as const

export const UPSTREAM_MODE = {
  SHARED: 'shared',
  DEDICATED: 'dedicated',
  BYOK: 'byok',
  HYBRID: 'hybrid',
} as const

export type CustomersDialogType =
  | 'create'
  | 'update'
  | 'detail'
  | 'topup'
  | 'disable'
  | 'enable'

export function getCustomerStatusOptions(t: TFunction) {
  return [
    { label: t('Enabled'), value: String(CUSTOMER_STATUS.ENABLED) },
    { label: t('Disabled'), value: String(CUSTOMER_STATUS.DISABLED) },
  ]
}

export function getUpstreamModeOptions(t: TFunction) {
  return [
    {
      value: UPSTREAM_MODE.SHARED,
      label: 'shared',
      description: t(
        'Use platform global channels only. Default mode; same as existing routing.'
      ),
    },
    {
      value: UPSTREAM_MODE.DEDICATED,
      label: 'dedicated',
      description: t(
        'Prefer channels bound to this customer. Falls back to global only when allowed.'
      ),
    },
    {
      value: UPSTREAM_MODE.BYOK,
      label: 'byok',
      description: t(
        "Prefer the customer's own upstream credentials (BYOK). Requires BYOK enabled."
      ),
    },
    {
      value: UPSTREAM_MODE.HYBRID,
      label: 'hybrid',
      description: t(
        'Try BYOK and dedicated bindings first, then fall back to global when allowed.'
      ),
    },
  ] as const
}
