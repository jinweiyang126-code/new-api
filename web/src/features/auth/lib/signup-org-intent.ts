/*
Copyright (C) 2023-2026 QuantumNous
*/
const SIGNUP_ORG_INTENT_KEY = 'tokenapi.signup_org'

export const SIGNUP_ORG_SETUP_PATH = '/sign-up?setup=organization'

export function setSignupOrgIntent(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) {
    window.sessionStorage.setItem(SIGNUP_ORG_INTENT_KEY, '1')
    return
  }
  window.sessionStorage.removeItem(SIGNUP_ORG_INTENT_KEY)
}

export function consumeSignupOrgIntent(): boolean {
  if (typeof window === 'undefined') return false
  const value = window.sessionStorage.getItem(SIGNUP_ORG_INTENT_KEY)
  window.sessionStorage.removeItem(SIGNUP_ORG_INTENT_KEY)
  return value === '1'
}

export function resolveSignupOrgRedirect(
  customerId: number | undefined
): string | undefined {
  if (!consumeSignupOrgIntent()) return undefined
  if (customerId && customerId > 0) return undefined
  return SIGNUP_ORG_SETUP_PATH
}
