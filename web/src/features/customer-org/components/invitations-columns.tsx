/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestamp } from '@/lib/format'

import {
  invitationStatusLabel,
  roleLabel,
} from '../lib/api-message'
import type { Invitation } from '../types'
import { useCustomerContext } from '../hooks/use-customer-context'
import { InvitationsRowActions } from './invitations-row-actions'

function invitationStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'accepted':
      return 'success'
    case 'pending':
      return 'warning'
    case 'revoked':
    case 'expired':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function useInvitationsColumns(): ColumnDef<Invitation>[] {
  const { t } = useTranslation()
  const { data: ctx } = useCustomerContext()
  const workspaces = ctx?.workspaces ?? []

  const workspaceNameById = (workspaceId: number | null | undefined) => {
    if (workspaceId == null || workspaceId === 0) {
      return (
        workspaces.find((ws) => ws.is_default)?.name || t('default')
      )
    }
    return (
      workspaces.find((ws) => ws.id === workspaceId)?.name ||
      `#${workspaceId}`
    )
  }

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
      accessorKey: 'email',
      header: t('Email'),
      size: 200,
      cell: ({ row }) => row.original.email || t('Open invite'),
      meta: { mobileOrder: 2, mobileTitle: true },
    },
    {
      accessorKey: 'role',
      header: t('Customer role'),
      size: 110,
      cell: ({ row }) => roleLabel(t, row.original.role),
      meta: { mobileOrder: 4, mobileHidden: true },
    },
    {
      accessorKey: 'workspace_role',
      header: t('Workspace role'),
      size: 120,
      cell: ({ row }) => roleLabel(t, row.original.workspace_role),
      meta: { mobileOrder: 5, mobileHidden: true },
    },
    {
      id: 'workspace',
      header: t('Workspace Name'),
      size: 140,
      enableSorting: false,
      cell: ({ row }) => workspaceNameById(row.original.workspace_id),
      meta: { mobileOrder: 6, mobileHidden: true },
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      size: 110,
      cell: ({ row }) => (
        <StatusBadge
          label={invitationStatusLabel(t, row.original.status)}
          variant={invitationStatusVariant(row.original.status)}
          copyable={false}
        />
      ),
      meta: { mobileOrder: 3, mobileBadge: true },
    },
    {
      accessorKey: 'expires_at',
      header: t('Expires At'),
      size: 160,
      cell: ({ row }) => formatTimestamp(row.original.expires_at),
      meta: { mobileOrder: 7, mobileHidden: true },
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      size: 56,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <InvitationsRowActions row={row} />,
      meta: { pinned: 'right', mobileOrder: 99 },
    },
  ]
}
