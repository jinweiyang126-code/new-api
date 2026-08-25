/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatQuota, formatTimestamp } from '@/lib/format'

import { CUSTOMER_STATUS } from '../constants'
import type { Customer } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useCustomersColumns(): ColumnDef<Customer>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'index',
      header: t('No.'),
      size: 64,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination
        return (
          <TableId value={pageIndex * pageSize + row.index + 1} />
        )
      },
      meta: { mobileOrder: 1, mobileTitle: true },
    },
    {
      accessorKey: 'id',
      header: t('ID'),
      size: 72,
      cell: ({ row }) => <TableId value={row.original.id} />,
      meta: { mobileOrder: 8, mobileHidden: true },
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      size: 180,
      cell: ({ row }) => (
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='truncate font-medium'>{row.original.name}</span>
          <span className='text-muted-foreground truncate text-xs'>
            {row.original.slug}
          </span>
        </div>
      ),
      meta: { mobileOrder: 2 },
    },
    {
      accessorKey: 'quota',
      header: t('Quota'),
      size: 140,
      cell: ({ row }) => (
        <div className='flex flex-col gap-0.5 text-sm'>
          <span>{formatQuota(row.original.quota)}</span>
          <span className='text-muted-foreground text-xs'>
            {t('Used')}: {formatQuota(row.original.used_quota)}
          </span>
        </div>
      ),
      meta: { mobileOrder: 4 },
    },
    {
      accessorKey: 'upstream_mode',
      header: t('Upstream Mode'),
      size: 120,
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.upstream_mode || 'shared'}
          variant='neutral'
          copyable={false}
        />
      ),
      meta: { mobileOrder: 5, mobileHidden: true },
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      size: 100,
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
      meta: { mobileOrder: 3, mobileBadge: true },
    },
    {
      accessorKey: 'owner_username',
      header: t('Owner'),
      size: 120,
      enableSorting: true,
      cell: ({ row }) =>
        row.original.owner_username ||
        (row.original.owner_user_id
          ? `#${row.original.owner_user_id}`
          : '—'),
      meta: { mobileOrder: 6, mobileHidden: true },
    },
    {
      accessorKey: 'created_at',
      header: t('Created At'),
      size: 160,
      cell: ({ row }) => formatTimestamp(row.original.created_at),
      meta: { mobileOrder: 7, mobileHidden: true },
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      size: 88,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right', mobileOrder: 99 },
    },
  ]
}
