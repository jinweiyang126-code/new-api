/*
Copyright (C) 2023-2026 QuantumNous
*/
const SIGNUP_ONBOARDING_KEY = 'tokenapi.signup_onboarding'

export const SIGNUP_ONBOARDING_PATH = '/onboarding'

export function setSignupOnboardingPending(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) {
    window.sessionStorage.setItem(SIGNUP_ONBOARDING_KEY, '1')
    return
  }
  window.sessionStorage.removeItem(SIGNUP_ONBOARDING_KEY)
}

export function hasSignupOnboardingPending(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(SIGNUP_ONBOARDING_KEY) === '1'
}

export function clearSignupOnboardingPending(): void {
  setSignupOnboardingPending(false)
}

export function consumeSignupOnboardingPending(): boolean {
  if (typeof window === 'undefined') return false
  const value = window.sessionStorage.getItem(SIGNUP_ONBOARDING_KEY)
  window.sessionStorage.removeItem(SIGNUP_ONBOARDING_KEY)
  return value === '1'
}

/** After sign-up auth, route new users to account-type onboarding when pending. */
export function resolveSignupOnboardingRedirect(
  customerId: number | undefined
): string | undefined {
  if (!consumeSignupOnboardingPending()) return undefined
  if (customerId && customerId > 0) return undefined
  return SIGNUP_ONBOARDING_PATH
}
