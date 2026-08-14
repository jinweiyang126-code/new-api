/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { UserMinus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'

import { CUSTOMER_ROLES } from '../constants'
import { type MemberRow, useMembers } from './members-provider'

export function MembersRowActions({ row }: { row: Row<MemberRow> }) {
  const { t } = useTranslation()
  const { isAdmin, setOpen, setCurrentMember } = useMembers()
  const member = row.original

  if (!isAdmin) return null
  if (member.scope === 'customer' && member.role === CUSTOMER_ROLES.OWNER) {
    return null
  }

  return (
    <DataTableRowActionMenu ariaLabel={t('Open menu')} contentClassName='w-44'>
      <DropdownMenuItem
        className='text-destructive focus:text-destructive'
        onClick={() => {
          setCurrentMember(member)
          setOpen('remove-member')
        }}
      >
        {t('Remove')}
        <DropdownMenuShortcut>
          <UserMinus size={16} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </DataTableRowActionMenu>
  )
}
