/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota, formatTimestamp } from '@/lib/format'

import { WORKSPACE_STATUS } from '../constants'
import type { Workspace } from '../types'
import { WorkspacesRowActions } from './workspaces-row-actions'
import { useWorkspaces } from './workspaces-provider'

export function useWorkspacesColumns(): ColumnDef<Workspace>[] {
  const { t } = useTranslation()
  const { currentWorkspaceId } = useWorkspaces()

  return [
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
      size: 180,
      cell: ({ row }) => {
        const ws = row.original
        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='truncate font-medium'>
              {ws.name}
              {ws.is_default ? (
                <span className='text-muted-foreground ml-2 text-xs font-normal'>
                  ({t('default')})
                </span>
              ) : null}
              {ws.id === currentWorkspaceId ? (
                <span className='text-primary ml-2 text-xs font-medium'>
                  ({t('Current')})
                </span>
              ) : null}
            </span>
            <span className='text-muted-foreground truncate text-xs'>
              {ws.slug}
            </span>
          </div>
        )
      },
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
      accessorKey: 'status',
      header: t('Status'),
      size: 100,
      cell: ({ row }) =>
        row.original.status === WORKSPACE_STATUS.ENABLED ? (
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
      accessorKey: 'created_at',
      header: t('Created At'),
      size: 160,
      cell: ({ row }) => formatTimestamp(row.original.created_at),
      meta: { mobileOrder: 5, mobileHidden: true },
    },
    {
      id: 'actions',
      size: 56,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <WorkspacesRowActions row={row} />,
      meta: { pinned: 'right', mobileOrder: 99 },
    },
  ]
}
