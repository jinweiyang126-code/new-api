/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { Eye, Power, PowerOff, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'

import { updateCustomer } from '../api'
import { CUSTOMER_STATUS } from '../constants'
import type { Customer } from '../types'
import { useCustomers } from './customers-provider'

export function DataTableRowActions({ row }: { row: Row<Customer> }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow, triggerRefresh } = useCustomers()
  const customer = row.original
  const enabled = customer.status === CUSTOMER_STATUS.ENABLED

  const openWith = (type: 'detail' | 'topup') => {
    setCurrentRow(customer)
    setOpen(type)
  }

  const toggleStatus = async () => {
    const next = enabled ? CUSTOMER_STATUS.DISABLED : CUSTOMER_STATUS.ENABLED
    const res = await updateCustomer(customer.id, { status: next })
    if (!res.success) {
      toast.error(res.message || t('Failed to update customer'))
      return
    }
    toast.success(enabled ? t('Customer disabled') : t('Customer enabled'))
    triggerRefresh()
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
      <DropdownMenuItem onClick={() => void toggleStatus()}>
        {enabled ? t('Disable') : t('Enable')}
        <DropdownMenuShortcut>
          {enabled ? <PowerOff size={16} /> : <Power size={16} />}
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </DataTableRowActionMenu>
  )
}
