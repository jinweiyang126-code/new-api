/*
Copyright (C) 2023-2026 QuantumNous
*/
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
