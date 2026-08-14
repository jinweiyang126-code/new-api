/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getCustomerInvitations } from '../api'
import type { Invitation } from '../types'
import { InvitationsBulkActions } from './invitations-bulk-actions'
import { useInvitationsColumns } from './invitations-columns'
import { useMembers } from './members-provider'
import { useCustomerContext } from '../hooks/use-customer-context'
import { resolveCurrentWorkspace } from '../lib/resolve-current-workspace'

const route = getRouteApi('/_authenticated/members/$section')

const SORTABLE = new Set([
  'id',
  'email',
  'role',
  'workspace_role',
  'status',
  'expires_at',
])

function compareInvitations(
  a: Invitation,
  b: Invitation,
  sortBy: string,
  desc: boolean
) {
  const dir = desc ? -1 : 1
  switch (sortBy) {
    case 'id':
    case 'expires_at': {
      const av = Number(a[sortBy as keyof Invitation] ?? 0)
      const bv = Number(b[sortBy as keyof Invitation] ?? 0)
      return (av - bv) * dir
    }
    case 'email':
    case 'role':
    case 'workspace_role':
    case 'status': {
      const av = String(a[sortBy as keyof Invitation] ?? '')
      const bv = String(b[sortBy as keyof Invitation] ?? '')
      return av.localeCompare(bv) * dir
    }
    default:
      return (a.id - b.id) * dir
  }
}

export function InvitationsTable() {
  const { t } = useTranslation()
  const columns = useInvitationsColumns()
  const { data: ctx } = useCustomerContext()
  const { currentWorkspace, isPersonal, currentWorkspaceId } =
    resolveCurrentWorkspace(ctx)
  const {
    customerId,
    refreshTrigger,
    isAdmin,
  } = useMembers()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sorting, setSorting] = useState<SortingState>([])

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: {
      pageKey: 'iPage',
      pageSizeKey: 'iPageSize',
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : 20,
    },
    globalFilter: { enabled: true, key: 'iFilter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'iStatus', type: 'array' },
    ],
  })

  const statusValue =
    ((columnFilters.find((f) => f.id === 'status')?.value as string[]) ??
      [])[0] ?? ''

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    if (pagination.pageIndex > 0) {
      onPaginationChange({ ...pagination, pageIndex: 0 })
    }
  }

  const { data: invitations = [], isLoading, isFetching } = useQuery({
    queryKey: ['customer-invitations', customerId, refreshTrigger],
    enabled: customerId > 0 && isAdmin,
    queryFn: async () => {
      const res = await getCustomerInvitations(customerId)
      if (!res.success) {
        toast.error(res.message || t('Failed to load invitations'))
        return []
      }
      return res.data ?? []
    },
    placeholderData: (prev) => prev,
  })

  const scoped = useMemo(() => {
    if (isPersonal) return invitations
    return invitations.filter((inv) => {
      if (inv.workspace_id == null || inv.workspace_id === 0) {
        return Boolean(currentWorkspace?.is_default)
      }
      return inv.workspace_id === currentWorkspaceId
    })
  }, [invitations, isPersonal, currentWorkspaceId, currentWorkspace?.is_default])

  const filtered = useMemo(() => {
    const keyword = globalFilter?.trim().toLowerCase() ?? ''
    const list = scoped.filter((inv) => {
      if (statusValue !== '' && inv.status !== statusValue) return false
      if (!keyword) return true
      return (
        (inv.email || '').toLowerCase().includes(keyword) ||
        inv.role.toLowerCase().includes(keyword) ||
        inv.workspace_role.toLowerCase().includes(keyword) ||
        inv.status.toLowerCase().includes(keyword)
      )
    })
    const activeSort = sorting[0]
    if (activeSort && SORTABLE.has(activeSort.id)) {
      return [...list].sort((a, b) =>
        compareInvitations(a, b, activeSort.id, activeSort.desc)
      )
    }
    return list
  }, [scoped, globalFilter, statusValue, sorting])

  const pageItems = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filtered.slice(start, start + pagination.pageSize)
  }, [filtered, pagination.pageIndex, pagination.pageSize])

  const { table } = useDataTable({
    data: pageItems,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    sorting,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    onSortingChange: handleSortingChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    totalCount: filtered.length,
    ensurePageInRange,
  })

  if (!isAdmin) return null

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No invitations')}
      emptyDescription={t('Create an invitation to add collaborators.')}
      skeletonKeyPrefix='invitations-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by email, role, or status...'),
        searchDebounceMs: 300,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: [
              { label: 'pending', value: 'pending' },
              { label: 'accepted', value: 'accepted' },
              { label: 'revoked', value: 'revoked' },
              { label: 'expired', value: 'expired' },
            ],
            singleSelect: true,
          },
        ],
      }}
      bulkActions={<InvitationsBulkActions table={table} />}
    />
  )
}
