/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getCustomerMembers, getWorkspaceMembers } from '../api'
import { CREDENTIAL_STATUS, getCredentialStatusOptions } from '../constants'
import { MembersBulkActions } from './members-bulk-actions'
import { useMembersColumns } from './members-columns'
import { type MemberRow, useMembers } from './members-provider'

const route = getRouteApi('/_authenticated/members/$section')

const SORTABLE = new Set(['id', 'username', 'role', 'status', 'created_at'])

function compareMembers(a: MemberRow, b: MemberRow, sortBy: string, desc: boolean) {
  const dir = desc ? -1 : 1
  switch (sortBy) {
    case 'id':
    case 'status':
    case 'created_at': {
      const av = Number(a[sortBy as keyof MemberRow] ?? 0)
      const bv = Number(b[sortBy as keyof MemberRow] ?? 0)
      return (av - bv) * dir
    }
    case 'username': {
      const av = a.username || `User #${a.user_id}`
      const bv = b.username || `User #${b.user_id}`
      return av.localeCompare(bv) * dir
    }
    case 'role':
      return a.role.localeCompare(b.role) * dir
    default:
      return (a.id - b.id) * dir
  }
}

export function MembersTable() {
  const { t } = useTranslation()
  const columns = useMembersColumns()
  const {
    customerId,
    refreshTrigger,
    isPersonal,
    currentWorkspaceId,
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
      pageKey: 'mPage',
      pageSizeKey: 'mPageSize',
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : 20,
    },
    globalFilter: { enabled: true, key: 'mFilter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'mStatus', type: 'array' },
      { columnId: 'role', searchKey: 'mRole', type: 'array' },
    ],
  })

  const statusValue =
    ((columnFilters.find((f) => f.id === 'status')?.value as string[]) ??
      [])[0] ?? ''
  const roleValue =
    ((columnFilters.find((f) => f.id === 'role')?.value as string[]) ??
      [])[0] ?? ''

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    if (pagination.pageIndex > 0) {
      onPaginationChange({ ...pagination, pageIndex: 0 })
    }
  }

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: [
      'members-table',
      customerId,
      isPersonal,
      currentWorkspaceId,
      refreshTrigger,
    ],
    enabled: customerId > 0 && (isPersonal || currentWorkspaceId > 0),
    queryFn: async (): Promise<MemberRow[]> => {
      if (isPersonal) {
        const res = await getCustomerMembers(customerId)
        if (!res.success) {
          toast.error(res.message || t('Failed to load members'))
          return []
        }
        return (res.data ?? []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          username: m.username,
          role: m.role,
          status: m.status,
          created_at: m.created_at,
          scope: 'customer' as const,
        }))
      }
      const res = await getWorkspaceMembers(currentWorkspaceId)
      if (!res.success) {
        toast.error(res.message || t('Failed to load members'))
        return []
      }
      return (res.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        username: m.username,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        scope: 'workspace' as const,
      }))
    },
    placeholderData: (prev) => prev,
  })

  const filtered = useMemo(() => {
    const keyword = globalFilter?.trim().toLowerCase() ?? ''
    const list = rows.filter((m) => {
      if (statusValue !== '' && String(m.status) !== statusValue) return false
      if (roleValue !== '' && m.role !== roleValue) return false
      if (!keyword) return true
      const name = (m.username || `User #${m.user_id}`).toLowerCase()
      return name.includes(keyword) || m.role.toLowerCase().includes(keyword)
    })
    const activeSort = sorting[0]
    if (activeSort && SORTABLE.has(activeSort.id)) {
      return [...list].sort((a, b) =>
        compareMembers(a, b, activeSort.id, activeSort.desc)
      )
    }
    return list
  }, [rows, globalFilter, statusValue, roleValue, sorting])

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

return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No members')}
      emptyDescription={
        isPersonal
          ? t('Switch to a workspace to see its members.')
          : t('Invite people to collaborate in this organization.')
      }
      skeletonKeyPrefix='members-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by username or role...'),
        searchDebounceMs: 300,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: getCredentialStatusOptions(t),
            singleSelect: true,
          },
          {
            columnId: 'role',
            title: t('Role'),
            options: [
              { label: 'owner', value: 'owner' },
              { label: 'admin', value: 'admin' },
              { label: 'member', value: 'member' },
            ],
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile: mobile }) => {
        if (row.original.status === CREDENTIAL_STATUS.DISABLED) {
          return mobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
        }
        return undefined
      }}
      bulkActions={<MembersBulkActions table={table} />}
    />
  )
}
