/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { Copy, Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'

import type { Invitation } from '../types'
import { useMembers } from './members-provider'

export function InvitationsRowActions({ row }: { row: Row<Invitation> }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentInvitation } = useMembers()
  const inv = row.original

  if (inv.status !== 'pending') return null

  return (
    <DataTableRowActionMenu ariaLabel={t('Open menu')} contentClassName='w-48'>
      <DropdownMenuItem
        onClick={async () => {
          const link = `${window.location.origin}/invitations/accept?token=${encodeURIComponent(inv.token)}`
          try {
            await navigator.clipboard.writeText(link)
            toast.success(t('Link copied'))
          } catch {
            toast.message(link)
          }
        }}
      >
        {t('Copy link')}
        <DropdownMenuShortcut>
          <Copy size={16} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        className='text-destructive focus:text-destructive'
        onClick={() => {
          setCurrentInvitation(inv)
          setOpen('revoke-invite')
        }}
      >
        {t('Revoke')}
        <DropdownMenuShortcut>
          <Ban size={16} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </DataTableRowActionMenu>
  )
}
