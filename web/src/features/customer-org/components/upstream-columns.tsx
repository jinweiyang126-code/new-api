/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestamp } from '@/lib/format'

import { CREDENTIAL_STATUS } from '../constants'
import type { UpstreamCredential } from '../types'
import { UpstreamRowActions } from './upstream-row-actions'

export function useUpstreamColumns(): ColumnDef<UpstreamCredential>[] {
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
      accessorKey: 'id',
      header: t('ID'),
      size: 72,
      cell: ({ row }) => <TableId value={row.original.id} />,
      meta: { mobileOrder: 1, mobileTitle: true },
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      size: 160,
      cell: ({ row }) => (
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='truncate font-medium'>{row.original.name}</span>
          <span className='text-muted-foreground truncate text-xs'>
            …{row.original.key_hint || '****'}
          </span>
        </div>
      ),
      meta: { mobileOrder: 2 },
    },
    {
      accessorKey: 'type',
      header: t('Type'),
      size: 100,
      cell: ({ row }) => row.original.type || '—',
      meta: { mobileOrder: 4, mobileHidden: true },
    },
    {
      accessorKey: 'base_url',
      header: t('Base URL'),
      size: 200,
      cell: ({ row }) => (
        <span className='truncate text-sm'>
          {row.original.base_url?.trim() || '—'}
        </span>
      ),
      meta: { mobileOrder: 5, mobileHidden: true },
    },
    {
      accessorKey: 'priority',
      header: t('Priority'),
      size: 88,
      cell: ({ row }) => row.original.priority,
      meta: { mobileOrder: 6, mobileHidden: true },
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      size: 100,
      cell: ({ row }) =>
        row.original.status === CREDENTIAL_STATUS.ENABLED ? (
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
      accessorKey: 'updated_at',
      header: t('Updated At'),
      size: 160,
      cell: ({ row }) => formatTimestamp(row.original.updated_at),
      meta: { mobileOrder: 7, mobileHidden: true },
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      size: 88,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <UpstreamRowActions row={row} />,
      meta: { pinned: 'right', mobileOrder: 99 },
    },
  ]
}
