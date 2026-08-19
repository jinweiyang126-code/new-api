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

import {
  SIGNUP_ORG_SETUP_PATH,
  consumeSignupOrgIntent,
  resolveSignupOrgRedirect,
  setSignupOrgIntent,
} from './signup-org-intent'
import { sanitizeAuthRedirect } from './auth-redirect'

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

describe('signup org intent', () => {
  test('stores and consumes organization intent once', () => {
    const store = installSessionStorage()
    setSignupOrgIntent(true)
    assert.equal(store.get('tokenapi.signup_org'), '1')
    assert.equal(consumeSignupOrgIntent(), true)
    assert.equal(store.has('tokenapi.signup_org'), false)
    assert.equal(consumeSignupOrgIntent(), false)
  })

  test('clears organization intent when disabled', () => {
    const store = installSessionStorage()
    setSignupOrgIntent(true)
    setSignupOrgIntent(false)
    assert.equal(store.has('tokenapi.signup_org'), false)
  })

  test('redirects to organization setup only when intent is set and no customer', () => {
    installSessionStorage()
    setSignupOrgIntent(true)
    assert.equal(resolveSignupOrgRedirect(0), SIGNUP_ORG_SETUP_PATH)
    assert.equal(resolveSignupOrgRedirect(undefined), undefined)

    setSignupOrgIntent(true)
    assert.equal(resolveSignupOrgRedirect(42), undefined)
  })

  test('organization setup path survives auth redirect sanitization', () => {
    assert.equal(
      sanitizeAuthRedirect(SIGNUP_ORG_SETUP_PATH, 'https://token.example.com'),
      SIGNUP_ORG_SETUP_PATH
    )
  })
})
