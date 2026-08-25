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

import { getCustomerWorkspaces } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { WORKSPACE_STATUS } from '../constants'
import { useCustomerContext } from '../hooks/use-customer-context'
import type { Workspace } from '../types'
import { WorkspacesBulkActions } from './workspaces-bulk-actions'
import { useWorkspacesColumns } from './workspaces-columns'
import { useWorkspaces } from './workspaces-provider'

const route = getRouteApi('/_authenticated/workspaces/')

const SORTABLE = new Set([
  'id',
  'name',
  'quota',
  'status',
  'created_at',
  'used_quota',
])

function compareWorkspaces(
  a: Workspace,
  b: Workspace,
  sortBy: string,
  desc: boolean
) {
  const dir = desc ? -1 : 1
  switch (sortBy) {
    case 'id':
    case 'quota':
    case 'status':
    case 'created_at':
    case 'used_quota': {
      const av = Number(a[sortBy as keyof Workspace] ?? 0)
      const bv = Number(b[sortBy as keyof Workspace] ?? 0)
      return (av - bv) * dir
    }
    case 'name': {
      return a.name.localeCompare(b.name) * dir
    }
    default:
      return (a.id - b.id) * dir
  }
}

export function WorkspacesTable() {
  const { t } = useTranslation()
  const columns = useWorkspacesColumns()
  const { refreshTrigger, currentWorkspaceId } = useWorkspaces()
  const { data: ctx } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
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
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
    ],
  })

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusValue = statusFilter[0] ?? ''

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    if (pagination.pageIndex > 0) {
      onPaginationChange({ ...pagination, pageIndex: 0 })
    }
  }

  const { data: workspaces = [], isLoading, isFetching } = useQuery({
    queryKey: ['customer-workspaces', customerId, refreshTrigger],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getCustomerWorkspaces(customerId)
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to load workspaces'))
        return []
      }
      return res.data ?? []
    },
    placeholderData: (prev) => prev,
  })

  const filtered = useMemo(() => {
    const keyword = globalFilter?.trim().toLowerCase() ?? ''
    const rows = workspaces.filter((ws) => {
      if (statusValue !== '' && String(ws.status) !== statusValue) {
        return false
      }
      if (!keyword) return true
      return (
        ws.name.toLowerCase().includes(keyword) ||
        ws.slug.toLowerCase().includes(keyword)
      )
    })

    const activeSort = sorting[0]
    if (activeSort && SORTABLE.has(activeSort.id)) {
      return [...rows].sort((a, b) =>
        compareWorkspaces(a, b, activeSort.id, activeSort.desc)
      )
    }
    return rows
  }, [workspaces, globalFilter, statusValue, sorting])

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
    initialColumnVisibility: { id: false },
    columnVisibilityStorageKey: 'workspaces-column-visibility',
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No workspaces')}
      emptyDescription={t('Create a workspace to organize tokens and quota.')}
      skeletonKeyPrefix='workspaces-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name or slug...'),
        searchDebounceMs: 300,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: [
              { label: t('Enabled'), value: String(WORKSPACE_STATUS.ENABLED) },
              {
                label: t('Disabled'),
                value: String(WORKSPACE_STATUS.DISABLED),
              },
            ],
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile: mobile }) => {
        if (row.original.status === WORKSPACE_STATUS.DISABLED) {
          return mobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
        }
        if (row.original.id === currentWorkspaceId) {
          return 'bg-primary/5'
        }
        return undefined
      }}
      bulkActions={<WorkspacesBulkActions table={table} />}
    />
  )
}
