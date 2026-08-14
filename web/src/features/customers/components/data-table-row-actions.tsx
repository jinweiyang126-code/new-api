/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { Eye, Power, PowerOff, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'

import { CUSTOMER_STATUS } from '../constants'
import type { Customer } from '../types'
import { useCustomers } from './customers-provider'

export function DataTableRowActions({ row }: { row: Row<Customer> }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useCustomers()
  const customer = row.original
  const enabled = customer.status === CUSTOMER_STATUS.ENABLED

  const openWith = (type: 'detail' | 'topup' | 'enable' | 'disable') => {
    setCurrentRow(customer)
    setOpen(type)
  }

  return (
    <DataTableRowActionMenu ariaLabel={t('Open menu')} contentClassName='w-48'>
      <DropdownMenuItem onClick={() => openWith('detail')}>
        {t('Details')}
        <DropdownMenuShortcut>
          <Eye size={16} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openWith('topup')}>
        {t('Top Up')}
        <DropdownMenuShortcut>
          <Wallet size={16} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        className={enabled ? 'text-destructive focus:text-destructive' : undefined}
        onClick={() => openWith(enabled ? 'disable' : 'enable')}
      >
        {enabled ? t('Disable') : t('Enable')}
        <DropdownMenuShortcut>
          {enabled ? <PowerOff size={16} /> : <Power size={16} />}
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </DataTableRowActionMenu>
  )
}
