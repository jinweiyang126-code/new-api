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
import { nanoid } from 'nanoid'

import { messagesSchema } from '@/features/playground/lib/storage/storage-schema'
import type { Message } from '@/features/playground/types'

export const TEXT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const TEXT_SESSION_STORAGE_VERSION = 1
const MAX_SESSIONS = 40

export type TextChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  group: string
  messages: Message[]
}

export type TextSessionStore = {
  version: number
  activeId: string | null
  lastModel: string
  lastGroup: string
  sessions: TextChatSession[]
}

function storageKey(userId: number): string {
  return `experience_text_sessions:${userId}`
}

export function emptyTextSessionStore(
  model = '',
  group = 'default'
): TextSessionStore {
  return {
    version: TEXT_SESSION_STORAGE_VERSION,
    activeId: null,
    lastModel: model,
    lastGroup: group,
    sessions: [],
  }
}

function pruneExpired(sessions: TextChatSession[], now: number) {
  return sessions.filter(
    (session) => now - session.updatedAt <= TEXT_SESSION_TTL_MS
  )
}

export function createEmptySession(
  model: string,
  group: string,
  now = Date.now()
): TextChatSession {
  return {
    id: nanoid(),
    title: '',
    createdAt: now,
    updatedAt: now,
    model,
    group,
    messages: [],
  }
}

export function titleFromMessages(messages: Message[], fallback: string) {
  const firstUser = messages.find((message) => message.from === 'user')
  const content = firstUser?.versions[0]?.content?.trim() ?? ''
  if (!content) return fallback
  return content.length > 36 ? `${content.slice(0, 36)}…` : content
}

export function loadTextSessionStore(userId: number): TextSessionStore {
  const fallback = emptyTextSessionStore()
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<TextSessionStore>
    const now = Date.now()
    const sessions = pruneExpired(
      Array.isArray(parsed.sessions)
        ? parsed.sessions
            .map((session) => normalizeSession(session))
            .filter((session): session is TextChatSession => session !== null)
        : [],
      now
    ).slice(0, MAX_SESSIONS)

    const activeId =
      parsed.activeId && sessions.some((session) => session.id === parsed.activeId)
        ? parsed.activeId
        : (sessions[0]?.id ?? null)

    return {
      version: TEXT_SESSION_STORAGE_VERSION,
      activeId,
      lastModel: parsed.lastModel || '',
      lastGroup: parsed.lastGroup || 'default',
      sessions,
    }
  } catch {
    return fallback
  }
}

function normalizeSession(value: unknown): TextChatSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<TextChatSession>
  if (!session.id || typeof session.createdAt !== 'number') return null

  let messages: Message[] = []
  try {
    messages = messagesSchema.parse(session.messages ?? []) as Message[]
  } catch {
    messages = []
  }

  return {
    id: session.id,
    title: typeof session.title === 'string' ? session.title : '',
    createdAt: session.createdAt,
    updatedAt:
      typeof session.updatedAt === 'number' ? session.updatedAt : session.createdAt,
    model: session.model || '',
    group: session.group || 'default',
    messages,
  }
}

export function saveTextSessionStore(
  userId: number,
  store: TextSessionStore
): void {
  const now = Date.now()
  const next: TextSessionStore = {
    ...store,
    version: TEXT_SESSION_STORAGE_VERSION,
    sessions: pruneExpired(store.sessions, now).slice(0, MAX_SESSIONS),
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(next))
}
