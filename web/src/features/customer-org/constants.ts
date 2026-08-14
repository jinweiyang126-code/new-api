/*
Copyright (C) 2023-2026 QuantumNous
*/
export const WORKSPACE_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
} as const

export const CREDENTIAL_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
} as const

export const CUSTOMER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export const WORKSPACE_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export function getCredentialStatusOptions(t: (key: string) => string) {
  return [
    { label: t('Enabled'), value: String(CREDENTIAL_STATUS.ENABLED) },
    { label: t('Disabled'), value: String(CREDENTIAL_STATUS.DISABLED) },
  ]
}
