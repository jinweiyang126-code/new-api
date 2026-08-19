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

import type { Message } from '@/features/playground/types'

import {
  TEXT_SESSION_TTL_MS,
  createEmptySession,
  loadTextSessionStore,
  saveTextSessionStore,
  titleFromMessages,
  type TextChatSession,
  type TextSessionStore,
} from '../text-sessions'

const memory = new Map<string, string>()

const localStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  clear() {
    memory.clear()
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageStub,
})

afterEach(() => {
  memory.clear()
})

function userMessage(content: string): Message {
  return {
    key: 'user-1',
    from: 'user',
    versions: [{ id: 'v1', content }],
  }
}

function session(
  patch: Partial<TextChatSession> & Pick<TextChatSession, 'id'>
): TextChatSession {
  const now = Date.now()
  return {
    title: '',
    createdAt: now,
    updatedAt: now,
    model: 'gpt-4o',
    group: 'default',
    messages: [],
    ...patch,
  }
}

function store(patch: Partial<TextSessionStore> = {}): TextSessionStore {
  return {
    version: 1,
    activeId: null,
    lastModel: '',
    lastGroup: 'default',
    sessions: [],
    ...patch,
  }
}

describe('text session titles', () => {
  test('uses the first user message and truncates long prompts', () => {
    assert.equal(titleFromMessages([], 'New chat'), 'New chat')
    assert.equal(
      titleFromMessages([userMessage('  hello  ')], 'New chat'),
      'hello'
    )
    assert.equal(
      titleFromMessages(
        [userMessage('abcdefghijklmnopqrstuvwxyz0123456789 extra')],
        'New chat'
      ),
      'abcdefghijklmnopqrstuvwxyz0123456789…'
    )
  })
})

describe('text session persistence', () => {
  test('keeps accounts on separate storage keys', () => {
    const alice = createEmptySession('gpt-4o', 'default')
    saveTextSessionStore(
      11,
      store({
        activeId: alice.id,
        lastModel: 'gpt-4o',
        sessions: [{ ...alice, title: 'alice' }],
      })
    )
    saveTextSessionStore(
      22,
      store({
        lastModel: 'qwen3.6-plus',
        sessions: [],
      })
    )

    assert.equal(loadTextSessionStore(11).sessions[0]?.title, 'alice')
    assert.equal(loadTextSessionStore(22).sessions.length, 0)
    assert.equal(loadTextSessionStore(22).lastModel, 'qwen3.6-plus')
    assert.notEqual(
      memory.get('experience_text_sessions:11'),
      memory.get('experience_text_sessions:22')
    )
  })

  test('drops sessions older than seven days and restores a valid active id', () => {
    const fresh = session({
      id: 'fresh',
      title: 'fresh',
      updatedAt: Date.now(),
    })
    const expired = session({
      id: 'expired',
      title: 'expired',
      updatedAt: Date.now() - TEXT_SESSION_TTL_MS - 1000,
    })

    saveTextSessionStore(
      7,
      store({
        activeId: 'expired',
        sessions: [expired, fresh],
      })
    )

    const loaded = loadTextSessionStore(7)
    assert.deepEqual(
      loaded.sessions.map((item) => item.id),
      ['fresh']
    )
    assert.equal(loaded.activeId, 'fresh')
  })

  test('returns an empty store when the saved payload is invalid json', () => {
    memory.set('experience_text_sessions:3', '{not-json')
    const loaded = loadTextSessionStore(3)
    assert.equal(loaded.sessions.length, 0)
    assert.equal(loaded.activeId, null)
  })
})
