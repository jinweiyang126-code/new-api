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
import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import type { TextChatSession } from '../lib/text-sessions'

type TextSessionSidebarProps = {
  sessions: TextChatSession[]
  activeId: string | null
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  className?: string
}

export function TextSessionSidebar({
  sessions,
  activeId,
  onCreate,
  onSelect,
  onDelete,
  className,
}: TextSessionSidebarProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sessions
    return sessions.filter((session) => {
      const title = (session.title || t('New chat')).toLowerCase()
      return title.includes(needle)
    })
  }, [query, sessions, t])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className='flex shrink-0 flex-col gap-3 p-3'>
        <Button
          className='w-full justify-start gap-2'
          onClick={onCreate}
          variant='outline'
        >
          <Plus className='size-4' />
          {t('New chat')}
        </Button>
        <div className='relative'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
          <Input
            className='pl-8'
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search sessions')}
            value={query}
          />
        </div>
      </div>

      <ScrollArea className='min-h-0 flex-1 px-2'>
        {filtered.length === 0 ? (
          <p className='text-muted-foreground px-2 py-8 text-center text-sm'>
            {t('No matching sessions')}
          </p>
        ) : (
          <ul className='flex flex-col gap-0.5 pb-3'>
            {filtered.map((session) => {
              const isActive = session.id === activeId
              return (
                <li key={session.id}>
                  <div
                    className={cn(
                      'group hover:bg-muted/70 flex items-center gap-1 rounded-lg px-2 py-2',
                      isActive && 'bg-muted'
                    )}
                  >
                    <button
                      className='min-w-0 flex-1 text-left'
                      onClick={() => onSelect(session.id)}
                      type='button'
                    >
                      <p className='truncate text-sm font-medium'>
                        {session.title || t('New chat')}
                      </p>
                      <p className='text-muted-foreground truncate text-[11px]'>
                        {new Date(session.updatedAt).toLocaleString()}
                      </p>
                    </button>
                    <Button
                      aria-label={t('Delete session')}
                      className='text-muted-foreground hover:text-destructive size-7 opacity-0 group-hover:opacity-100'
                      onClick={() => onDelete(session.id)}
                      size='icon'
                      variant='ghost'
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>

      <p className='text-muted-foreground shrink-0 px-4 py-3 text-[11px] leading-relaxed'>
        {t(
          'Chat history is kept for 7 days. Back up anything important.'
        )}
      </p>
    </div>
  )
}
