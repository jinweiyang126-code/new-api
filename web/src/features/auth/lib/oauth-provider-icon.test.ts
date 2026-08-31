/*
Copyright (C) 2023-2026 QuantumNous
*/
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { resolveOAuthProviderIcon } from './oauth-provider-icon'

describe('resolveOAuthProviderIcon', () => {
  test('uses https image URL first', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({
        name: 'GitHub Enterprise',
        slug: 'github-enterprise',
        icon: 'https://cdn.example.com/github.svg',
      }),
      { kind: 'url', url: 'https://cdn.example.com/github.svg' }
    )
  })

  test('maps icon identifier to built-in brand SVG', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({ name: 'My GitLab', icon: 'gitlab' }),
      { kind: 'brand', key: 'gitlab' }
    )
    assert.deepEqual(
      resolveOAuthProviderIcon({ name: 'Google Workspace', icon: 'google' }),
      { kind: 'brand', key: 'google' }
    )
  })

  test('infers brand from slug when icon is empty', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({
        name: 'GitHub Enterprise',
        slug: 'github-enterprise',
        icon: '',
      }),
      { kind: 'brand', key: 'github' }
    )
  })

  test('infers brand from provider name', () => {
    assert.deepEqual(resolveOAuthProviderIcon({ name: 'Discord SSO' }), {
      kind: 'brand',
      key: 'discord',
    })
  })

  test('falls back to letter when no brand matches', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({ name: 'Keycloak', slug: 'keycloak' }),
      { kind: 'letter', letter: 'K' }
    )
  })

  test('does not infer brand when icon is an unknown identifier', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({
        name: 'GitHub Enterprise',
        slug: 'github-enterprise',
        icon: 'gitea',
      }),
      { kind: 'letter', letter: 'G' }
    )
  })

  test('rejects non-https icon URLs', () => {
    assert.deepEqual(
      resolveOAuthProviderIcon({ name: 'Acme', icon: 'http://example.com/a.png' }),
      { kind: 'letter', letter: 'A' }
    )
  })
})
