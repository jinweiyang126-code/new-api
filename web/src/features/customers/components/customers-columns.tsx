/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota, formatTimestamp } from '@/lib/format'

import { CUSTOMER_STATUS } from '../constants'
import type { Customer } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useCustomersColumns(): ColumnDef<Customer>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      cell: ({ row }) => <TableId value={row.original.id} />,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      cell: ({ row }) => (
        <div className='flex flex-col gap-0.5'>
          <span className='font-medium'>{row.original.name}</span>
          <span className='text-muted-foreground text-xs'>
            {row.original.slug}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'quota',
      header: t('Quota'),
      cell: ({ row }) => formatQuota(row.original.quota),
    },
    {
      accessorKey: 'upstream_mode',
      header: t('Upstream Mode'),
      cell: ({ row }) => row.original.upstream_mode || 'shared',
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) =>
        row.original.status === CUSTOMER_STATUS.ENABLED ? (
          <StatusBadge label={t('Enabled')} variant='success' copyable={false} />
        ) : (
          <StatusBadge
            label={t('Disabled')}
            variant='danger'
            copyable={false}
          />
        ),
    },
    {
      accessorKey: 'owner_user_id',
      header: t('Owner'),
      cell: ({ row }) => row.original.owner_user_id,
    },
    {
      accessorKey: 'created_at',
      header: t('Created At'),
      cell: ({ row }) => formatTimestamp(row.original.created_at),
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
