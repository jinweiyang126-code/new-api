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
import { describe, test } from 'node:test'

import { isTextChatModel } from '../chat-models'

describe('isTextChatModel', () => {
  test('keeps chat model names when endpoint metadata is missing', () => {
    assert.equal(isTextChatModel('gpt-4o'), true)
    assert.equal(isTextChatModel('qwen3.6-plus'), true)
    assert.equal(isTextChatModel('claude-sonnet-4'), true)
  })

  test('drops image, video, and speech model names without endpoints', () => {
    assert.equal(isTextChatModel('seedance-2.5'), false)
    assert.equal(isTextChatModel('seedream-4.0'), false)
    assert.equal(isTextChatModel('dall-e-3'), false)
    assert.equal(isTextChatModel('gpt-image-1'), false)
    assert.equal(isTextChatModel('whisper-1'), false)
    assert.equal(isTextChatModel('text-embedding-3-small'), false)
  })

  test('uses catalog endpoints when present instead of the model name', () => {
    assert.equal(isTextChatModel('custom-chat', ['openai']), true)
    assert.equal(isTextChatModel('gpt-4o', ['image-generation']), false)
    assert.equal(
      isTextChatModel('omni-model', ['openai', 'image-generation']),
      false
    )
    assert.equal(isTextChatModel('unknown-model', ['rerank']), false)
  })

  test('falls back to the name heuristic for an empty endpoint list', () => {
    assert.equal(isTextChatModel('gpt-4o', []), true)
    assert.equal(isTextChatModel('seedance-2.0', []), false)
  })
})
