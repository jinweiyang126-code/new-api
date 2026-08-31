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
import { ArrowUp, Plus, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  ATTACHMENT_ACTIONS,
  getAttachmentActionNotice,
  getSubmittableInputText,
} from '@/features/playground/lib'
import type { GroupOption, ModelOption } from '@/features/playground/types'

type TextComposerProps = {
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  groups: GroupOption[]
  modelValue: string
  groupValue: string
  isModelLoading?: boolean
  onModelChange: (value: string) => void
  onGroupChange: (value: string) => void
  onSubmit: (text: string) => void
  onStop?: () => void
}

export function TextComposer({
  disabled,
  isGenerating,
  models,
  groups,
  modelValue,
  groupValue,
  isModelLoading,
  onModelChange,
  onGroupChange,
  onSubmit,
  onStop,
}: TextComposerProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const canSubmit =
    Boolean(text.trim()) && !disabled && !isGenerating && models.length > 0

  const submit = () => {
    const next = getSubmittableInputText(
      { text },
      disabled || isGenerating || models.length === 0
    )
    if (!next) return
    onSubmit(next)
    setText('')
  }

  return (
    <div className='mx-auto w-full max-w-3xl px-4 pb-4'>
      <div className='border-border/70 bg-background focus-within:border-primary/40 flex items-end gap-3 rounded-[28px] border px-2 py-1.5 shadow-xs'>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t('Attach')}
                className='text-muted-foreground size-9 shrink-0 rounded-full'
                disabled={disabled}
                size='icon'
                variant='ghost'
              />
            }
          >
            <Plus className='size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {ATTACHMENT_ACTIONS.map(({ action, icon: Icon, label }) => (
              <DropdownMenuItem
                key={action}
                onClick={() => {
                  const notice = getAttachmentActionNotice(action)
                  toast.info(t(notice.title), {
                    description: notice.description,
                  })
                }}
              >
                <Icon className='mr-2 size-4' />
                {t(label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          className='placeholder:text-muted-foreground field-sizing-fixed max-h-32 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-2.5 py-2 shadow-none focus-visible:ring-0'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={t('Send a message')}
          rows={1}
          value={text}
        />

        <div className='flex shrink-0 items-center gap-1 pr-0.5 pb-0.5'>
          <ModelGroupSelector
            className='h-8 max-w-[11rem] rounded-full border-0 bg-muted/70 sm:max-w-[14rem]'
            disabled={disabled || isModelLoading}
            groups={groups}
            models={models}
            onGroupChange={onGroupChange}
            onModelChange={onModelChange}
            selectedGroup={groupValue}
            selectedModel={modelValue}
          />
          {isGenerating ? (
            <Button
              aria-label={t('Stop')}
              className='size-9 rounded-full'
              onClick={onStop}
              size='icon'
              variant='secondary'
            >
              <Square className='size-3.5 fill-current' />
            </Button>
          ) : (
            <Button
              aria-label={t('Send')}
              className='size-9 rounded-full'
              disabled={!canSubmit}
              onClick={submit}
              size='icon'
            >
              <ArrowUp className='size-4' />
            </Button>
          )}
        </div>
      </div>
      <p className='text-muted-foreground mt-2 text-center text-[11px]'>
        {t(
          'You can upload files, switch models, and test OpenAI-compatible text generation.'
        )}
      </p>
    </div>
  )
}
