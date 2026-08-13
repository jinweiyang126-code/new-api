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
import { getUsers, searchUsers } from '@/features/users/api'
import type { User } from '@/features/users/types'
import { cn } from '@/lib/utils'

type OwnerUserPickerProps = {
  value: number
  onValueChange: (userId: number) => void
  disabled?: boolean
}

function userLabel(user: User) {
  const name = user.display_name?.trim() || user.username
  if (name === user.username) {
    return `${user.username} (#${user.id})`
  }
  return `${name} (@${user.username}, #${user.id})`
}

export function OwnerUserPicker({
  value,
  onValueChange,
  disabled,
}: OwnerUserPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['customer-owner-users', keyword],
    queryFn: async () => {
      const res = keyword.trim()
        ? await searchUsers({
            keyword: keyword.trim(),
            p: 1,
            page_size: 50,
          })
        : await getUsers({ p: 1, page_size: 50 })
      if (!res.success) {
        throw new Error(res.message || 'Failed to load users')
      }
      return (res.data?.items ?? []) as User[]
    },
    enabled: open,
    staleTime: 15_000,
  })

  const users = data ?? []

  const selected = useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value]
  )

  // Keep label for selected id even if not in current page (after search).
  const [selectedCache, setSelectedCache] = useState<User | null>(null)
  const displayUser = selected ?? (selectedCache?.id === value ? selectedCache : null)

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
            className='w-full justify-between font-normal'
          />
        }
      >
        <span className='truncate'>
          {displayUser
            ? userLabel(displayUser)
            : value > 0
              ? `#${value}`
              : t('Select owner user')}
        </span>
        <ChevronsUpDown className='ms-2 size-4 shrink-0 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-80 p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search username...')}
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? t('Loading...') : t('No users found')}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={String(user.id)}
                  onSelect={() => {
                    onValueChange(user.id)
                    setSelectedCache(user)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'me-2 size-4',
                      value === user.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium'>
                      {user.display_name?.trim() || user.username}
                    </div>
                    <div className='text-muted-foreground truncate text-xs'>
                      @{user.username} · ID {user.id}
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
