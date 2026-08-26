/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { sanitizeAuthRedirect } from './auth-redirect'
import {
  SIGNUP_ONBOARDING_PATH,
  consumeSignupOnboardingPending,
  resolveSignupOnboardingRedirect,
  setSignupOnboardingPending,
} from './signup-onboarding'

function installSessionStorage() {
  const store = new Map<string, string>()
  const sessionStorage = {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage,
  })
  return store
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'sessionStorage')
})

describe('signup onboarding', () => {
  test('stores and consumes onboarding intent once', () => {
    const store = installSessionStorage()
    setSignupOnboardingPending(true)
    assert.equal(store.get('tokenapi.signup_onboarding'), '1')
    assert.equal(consumeSignupOnboardingPending(), true)
    assert.equal(store.has('tokenapi.signup_onboarding'), false)
    assert.equal(consumeSignupOnboardingPending(), false)
  })

  test('clears onboarding intent when disabled', () => {
    const store = installSessionStorage()
    setSignupOnboardingPending(true)
    setSignupOnboardingPending(false)
    assert.equal(store.has('tokenapi.signup_onboarding'), false)
  })

  test('redirects to onboarding only when intent is set and no customer', () => {
    installSessionStorage()
    setSignupOnboardingPending(true)
    assert.equal(resolveSignupOnboardingRedirect(0), SIGNUP_ONBOARDING_PATH)

    setSignupOnboardingPending(true)
    assert.equal(resolveSignupOnboardingRedirect(undefined), SIGNUP_ONBOARDING_PATH)

    setSignupOnboardingPending(true)
    assert.equal(resolveSignupOnboardingRedirect(42), undefined)

    assert.equal(resolveSignupOnboardingRedirect(undefined), undefined)
  })

  test('onboarding path survives auth redirect sanitization', () => {
    assert.equal(
      sanitizeAuthRedirect(SIGNUP_ONBOARDING_PATH, 'https://token.example.com'),
      SIGNUP_ONBOARDING_PATH
    )
  })
})
