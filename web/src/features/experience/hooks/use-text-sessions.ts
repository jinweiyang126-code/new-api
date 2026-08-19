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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyMessageStateUpdate,
  type MessageStateUpdater,
} from '@/features/playground/lib'

import {
  createEmptySession,
  emptyTextSessionStore,
  loadTextSessionStore,
  saveTextSessionStore,
  titleFromMessages,
  type TextChatSession,
  type TextSessionStore,
} from '../lib/text-sessions'

const SAVE_DEBOUNCE_MS = 400

type UseTextSessionsArgs = {
  userId: number | undefined
  model: string
  group: string
}

export function useTextSessions({ userId, model, group }: UseTextSessionsArgs) {
  const { t } = useTranslation()
  const untitled = t('New chat')
  const [store, setStore] = useState<TextSessionStore>(() =>
    userId ? loadTextSessionStore(userId) : emptyTextSessionStore()
  )
  const [isLoading, setIsLoading] = useState(true)
  const saveTimerRef = useRef<number | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store

  const persist = useCallback(
    (next: TextSessionStore) => {
      if (!userId) return
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        saveTextSessionStore(userId, next)
      }, SAVE_DEBOUNCE_MS)
    },
    [userId]
  )

  const commit = useCallback(
    (updater: (prev: TextSessionStore) => TextSessionStore) => {
      setStore((prev) => {
        const next = updater(prev)
        persist(next)
        return next
      })
    },
    [persist]
  )

  useEffect(() => {
    if (!userId) {
      setStore(emptyTextSessionStore())
      setIsLoading(false)
      return
    }
    const loaded = loadTextSessionStore(userId)
    setStore(loaded)
    setIsLoading(false)
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTextSessionStore(userId, storeRef.current)
      }
    }
  }, [userId])

  const active = useMemo(
    () => store.sessions.find((session) => session.id === store.activeId) ?? null,
    [store.activeId, store.sessions]
  )

  const createSession = useCallback(() => {
    const current = storeRef.current.sessions.find(
      (session) => session.id === storeRef.current.activeId
    )
    if (current && current.messages.length === 0) {
      return current.id
    }

    const session = createEmptySession(
      model || storeRef.current.lastModel,
      group || storeRef.current.lastGroup
    )
    commit((prev) => ({
      ...prev,
      activeId: session.id,
      lastModel: session.model,
      lastGroup: session.group,
      sessions: [session, ...prev.sessions],
    }))
    return session.id
  }, [commit, group, model])

  const selectSession = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, activeId: id }))
    },
    [commit]
  )

  const deleteSession = useCallback(
    (id: string) => {
      commit((prev) => {
        const sessions = prev.sessions.filter((session) => session.id !== id)
        const activeId =
          prev.activeId === id ? (sessions[0]?.id ?? null) : prev.activeId
        return { ...prev, sessions, activeId }
      })
    },
    [commit]
  )

  const updateActiveMessages = useCallback(
    (updater: MessageStateUpdater) => {
      commit((prev) => {
        if (!prev.activeId) {
          const session = createEmptySession(
            model || prev.lastModel,
            group || prev.lastGroup
          )
          const messages = applyMessageStateUpdate([], updater)
          return {
            ...prev,
            activeId: session.id,
            lastModel: session.model,
            lastGroup: session.group,
            sessions: [
              {
                ...session,
                messages,
                title: titleFromMessages(messages, untitled),
                updatedAt: Date.now(),
              },
              ...prev.sessions,
            ],
          }
        }

        return {
          ...prev,
          sessions: prev.sessions.map((session) => {
            if (session.id !== prev.activeId) return session
            const messages = applyMessageStateUpdate(session.messages, updater)
            return {
              ...session,
              messages,
              title: titleFromMessages(messages, untitled),
              updatedAt: Date.now(),
            }
          }),
        }
      })
    },
    [commit, group, model, untitled]
  )

  const updateActiveMeta = useCallback(
    (patch: Partial<Pick<TextChatSession, 'model' | 'group'>>) => {
      commit((prev) => ({
        ...prev,
        lastModel: patch.model ?? prev.lastModel,
        lastGroup: patch.group ?? prev.lastGroup,
        sessions: prev.sessions.map((session) =>
          session.id === prev.activeId ? { ...session, ...patch } : session
        ),
      }))
    },
    [commit]
  )

  return {
    isLoading,
    sessions: store.sessions,
    active,
    activeId: store.activeId,
    lastModel: store.lastModel,
    lastGroup: store.lastGroup,
    createSession,
    selectSession,
    deleteSession,
    updateActiveMessages,
    updateActiveMeta,
  }
}
