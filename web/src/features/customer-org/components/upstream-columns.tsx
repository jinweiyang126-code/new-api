/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { CHANNEL_TYPES } from '@/features/channels/constants'
import { getChannelTypeLabel } from '@/features/channels/lib'
import { formatTimestamp } from '@/lib/format'

import { CREDENTIAL_STATUS } from '../constants'
import type { UpstreamCredential } from '../types'
import { UpstreamRowActions } from './upstream-row-actions'

function formatCredentialType(type: string, t: (key: string) => string): string {
  const raw = (type || '').trim()
  if (!raw) return '—'
  const asNum = Number.parseInt(raw, 10)
  if (!Number.isNaN(asNum) && asNum > 0) {
    const label = getChannelTypeLabel(asNum)
    return label === 'Unknown' ? raw : t(label)
  }
  const byName = Object.entries(CHANNEL_TYPES).find(
    ([, label]) => label.toLowerCase() === raw.toLowerCase()
  )
  if (byName) return t(byName[1])
  return raw
}

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
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
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
        return <TableId value={pageIndex * pageSize + row.index + 1} />
      },
      meta: { mobileOrder: 1 },
    },
    {
      accessorKey: 'id',
      header: t('ID'),
      size: 72,
      cell: ({ row }) => <TableId value={row.original.id} />,
      meta: { mobileOrder: 9, mobileHidden: true },
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
      meta: { mobileOrder: 2, mobileTitle: true },
    },
    {
      accessorKey: 'type',
      header: t('Type'),
      size: 100,
      cell: ({ row }) => formatCredentialType(row.original.type, t),
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
      header: t('Order'),
      size: 88,
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm tabular-nums'>
          {row.original.priority}
        </span>
      ),
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
