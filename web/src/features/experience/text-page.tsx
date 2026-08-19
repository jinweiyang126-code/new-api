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
import { History, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PlaygroundChat } from '@/features/playground/components/chat/playground-chat'
import { DEFAULT_PARAMETER_ENABLED } from '@/features/playground/constants'
import {
  useChatHandler,
  usePlaygroundConversation,
} from '@/features/playground/hooks'
import type { PlaygroundConfig } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

import { ExperienceShell } from './components/experience-shell'
import { TextComposer } from './components/text-composer'
import { TextEmptyState } from './components/text-empty-state'
import { TextSessionSidebar } from './components/text-session-sidebar'
import { useTextChatModels } from './hooks/use-text-chat-models'
import { useTextSessions } from './hooks/use-text-sessions'

export function ExperienceTextPage() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [config, setConfig] = useState<PlaygroundConfig>({
    model: '',
    group: '',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    stream: true,
  })

  const {
    isLoading: isLoadingSessions,
    sessions: sessionList,
    active,
    activeId,
    lastModel,
    lastGroup,
    createSession,
    selectSession,
    deleteSession,
    updateActiveMessages,
    updateActiveMeta,
  } = useTextSessions({
    userId,
    model: config.model,
    group: config.group,
  })

  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
      if (key === 'model' || key === 'group') {
        updateActiveMeta({ [key]: value } as {
          model?: string
          group?: string
        })
      }
    },
    [updateActiveMeta]
  )

  const onGroupChange = useCallback(
    (value: string) => updateConfig('group', value),
    [updateConfig]
  )
  const onModelChange = useCallback(
    (value: string) => updateConfig('model', value),
    [updateConfig]
  )

  const modelValue = active?.model || config.model || lastModel
  const groupValue = active?.group || config.group || lastGroup || 'default'

  const { models, groups, isLoadingModels } = useTextChatModels({
    group: groupValue,
    model: modelValue,
    onGroupChange,
    onModelChange,
  })

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config: {
      ...config,
      model: modelValue,
      group: groupValue,
    },
    parameterEnabled: DEFAULT_PARAMETER_ENABLED,
    onMessageUpdate: updateActiveMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages: active?.messages ?? [],
    updateMessages: updateActiveMessages,
    sendChat,
  })

  const handleCreate = () => {
    stopGeneration()
    handleEditOpenChange(false)
    createSession()
    setHistoryOpen(false)
  }

  const handleSelect = (id: string) => {
    stopGeneration()
    handleEditOpenChange(false)
    selectSession(id)
    setHistoryOpen(false)
  }

  return (
    <ExperienceShell
      logsLabel={t('View in usage logs')}
      logsTo='/usage-logs/common'
      mode='text'
    >
      <div className='flex min-h-0 flex-1'>
        <aside className='border-border/70 hidden w-[272px] shrink-0 border-r lg:flex'>
          <TextSessionSidebar
            activeId={activeId}
            onCreate={handleCreate}
            onDelete={deleteSession}
            onSelect={handleSelect}
            sessions={sessionList}
          />
        </aside>

        <section className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <div className='border-border/70 flex items-center gap-2 border-b px-3 py-2 lg:hidden'>
            <Button
              className='gap-1.5'
              onClick={handleCreate}
              size='sm'
              variant='outline'
            >
              <Plus className='size-4' />
              {t('New chat')}
            </Button>
            <Button
              onClick={() => setHistoryOpen(true)}
              size='sm'
              variant='ghost'
            >
              <History className='size-4' />
              {t('Search sessions')}
            </Button>
          </div>

          <div className='relative min-h-0 flex-1 overflow-hidden'>
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.22]'
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 9v10M9 14h10' stroke='%23888' stroke-width='1' fill='none'/%3E%3C/svg%3E\")",
              }}
            />
            <div className='relative min-h-0 h-full'>
              <PlaygroundChat
                editingKey={editingMessageKey}
                emptyState={<TextEmptyState />}
                isGenerating={isGenerating}
                isLoadingMessages={isLoadingSessions}
                messages={active?.messages ?? []}
                onCancelEdit={handleEditOpenChange}
                onDeleteMessage={handleDeleteMessage}
                onEditMessage={handleEditMessage}
                onRegenerateMessage={handleRegenerateMessage}
                onSaveEdit={(content) => applyEdit(content, false)}
                onSaveEditAndSubmit={(content) => applyEdit(content, true)}
              />
            </div>
          </div>

          <TextComposer
            disabled={isGenerating}
            groupValue={groupValue}
            groups={groups}
            isGenerating={isGenerating}
            isModelLoading={isLoadingModels}
            modelValue={modelValue}
            models={models}
            onGroupChange={(value) => updateConfig('group', value)}
            onModelChange={(value) => updateConfig('model', value)}
            onStop={stopGeneration}
            onSubmit={handleSendMessage}
          />
        </section>
      </div>

      <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
        <SheetContent className='w-[min(100%,20rem)] p-0' side='left'>
          <SheetHeader className='sr-only'>
            <SheetTitle>{t('Search sessions')}</SheetTitle>
          </SheetHeader>
          <TextSessionSidebar
            activeId={activeId}
            onCreate={handleCreate}
            onDelete={deleteSession}
            onSelect={handleSelect}
            sessions={sessionList}
          />
        </SheetContent>
      </Sheet>
    </ExperienceShell>
  )
}
