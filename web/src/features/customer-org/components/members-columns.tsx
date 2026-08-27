/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { BadgeListCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatQuota, formatTimestamp } from '@/lib/format'

import { CREDENTIAL_STATUS } from '../constants'
import { roleLabel } from '../lib/api-message'
import type { MemberRow } from './members-provider'
import { useMembers } from './members-provider'
import { MembersRowActions } from './members-row-actions'

export function useMembersColumns(): ColumnDef<MemberRow>[] {
  const { t } = useTranslation()
  const { isAdmin } = useMembers()

  const columns: ColumnDef<MemberRow>[] = [
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
      meta: { mobileOrder: 8, mobileHidden: true },
    },
    {
      accessorKey: 'username',
      header: t('Username'),
      size: 180,
      cell: ({ row }) =>
        row.original.username || `User #${row.original.user_id}`,
      meta: { mobileOrder: 2, mobileTitle: true },
    },
    {
      accessorKey: 'role',
      header: t('Role'),
      size: 120,
      cell: ({ row }) => (
        <StatusBadge
          label={roleLabel(t, row.original.role)}
          variant='neutral'
          copyable={false}
        />
      ),
      meta: { mobileOrder: 3 },
    },
    {
      id: 'workspace_id',
      accessorFn: () => '',
      header: () => null,
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
      size: 0,
      meta: { mobileHidden: true },
    },
    {
      id: 'workspace_names',
      accessorFn: (row) => row.workspace_names.join(', '),
      header: t('Workspace Name'),
      size: 180,
      cell: ({ row }) => (
        <BadgeListCell
          items={row.original.workspace_names.map((name) => (
            <StatusBadge
              key={name}
              label={name}
              autoColor={name}
              size='sm'
            />
          ))}
        />
      ),
      meta: { mobileOrder: 4 },
    },
    ...(isAdmin
      ? [
          {
            accessorKey: 'org_wallet_balance',
            header: t('Quota'),
            size: 120,
            cell: ({ row }) => (
              <span className='font-mono text-sm tabular-nums'>
                {formatQuota(row.original.org_wallet_balance ?? 0)}
              </span>
            ),
            meta: { mobileOrder: 5 },
          } satisfies ColumnDef<MemberRow>,
        ]
      : []),
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
      meta: { mobileOrder: 6, mobileBadge: true },
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
      size: 56,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <MembersRowActions row={row} />,
      meta: { pinned: 'right', mobileOrder: 99 },
    },
  ]

  return columns
}
