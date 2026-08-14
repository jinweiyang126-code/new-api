/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getChannels, searchChannels } from '@/features/channels/api'
import type { Channel } from '@/features/channels/types'
import { cn } from '@/lib/utils'

type ChannelPickerProps = {
  value: number
  onValueChange: (channelId: number, channel?: Channel) => void
  excludeIds?: number[]
  disabled?: boolean
}

function channelLabel(channel: Channel) {
  return `${channel.name} (#${channel.id})`
}

export function ChannelPicker({
  value,
  onValueChange,
  excludeIds = [],
  disabled,
}: ChannelPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [selectedCache, setSelectedCache] = useState<Channel | null>(null)

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds])

  const { data, isFetching } = useQuery({
    queryKey: ['customer-binding-channels', keyword],
    queryFn: async () => {
      const res = keyword.trim()
        ? await searchChannels({
            keyword: keyword.trim(),
            p: 1,
            page_size: 50,
          })
        : await getChannels({ p: 1, page_size: 50 })
      if (!res.success) {
        throw new Error(res.message || 'Failed to load channels')
      }
      return (res.data?.items ?? []) as Channel[]
    },
    enabled: open,
    staleTime: 15_000,
  })

  const channels = useMemo(
    () => (data ?? []).filter((ch) => !excludeSet.has(ch.id) || ch.id === value),
    [data, excludeSet, value]
  )

  const selected = useMemo(
    () => channels.find((ch) => ch.id === value) ?? null,
    [channels, value]
  )
  const displayChannel =
    selected ?? (selectedCache?.id === value ? selectedCache : null)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={disabled}
            className='w-full min-w-56 justify-between font-normal'
          />
        }
      >
        <span className='truncate'>
          {(() => {
            if (displayChannel) return channelLabel(displayChannel)
            if (value > 0) return `#${value}`
            return t('Select channel')
          })()}
        </span>
        <ChevronsUpDown className='ms-2 size-4 shrink-0 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-80 p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search channel...')}
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? t('Loading...') : t('No channels found')}
            </CommandEmpty>
            <CommandGroup>
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={String(channel.id)}
                  onSelect={() => {
                    onValueChange(channel.id, channel)
                    setSelectedCache(channel)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'me-2 size-4',
                      value === channel.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium'>{channel.name}</div>
                    <div className='text-muted-foreground truncate text-xs'>
                      ID {channel.id}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
