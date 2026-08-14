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
