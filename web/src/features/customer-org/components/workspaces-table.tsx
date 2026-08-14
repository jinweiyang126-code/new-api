/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
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
import { WORKSPACE_STATUS } from '../constants'
import { useCustomerContext } from '../hooks/use-customer-context'
import { useWorkspacesColumns } from './workspaces-columns'
import { useWorkspaces } from './workspaces-provider'

const route = getRouteApi('/_authenticated/workspaces/')

export function WorkspacesTable() {
  const { t } = useTranslation()
  const columns = useWorkspacesColumns()
  const { refreshTrigger, currentWorkspaceId } = useWorkspaces()
  const { data: ctx } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const isMobile = useMediaQuery('(max-width: 640px)')

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

  const { data: workspaces = [], isLoading, isFetching } = useQuery({
    queryKey: ['customer-workspaces', customerId, refreshTrigger],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getCustomerWorkspaces(customerId)
      if (!res.success) {
        toast.error(res.message || t('Failed to load workspaces'))
        return []
      }
      return res.data ?? []
    },
    placeholderData: (prev) => prev,
  })

  const filtered = useMemo(() => {
    const keyword = globalFilter?.trim().toLowerCase() ?? ''
    const status = statusFilter[0]
    return workspaces.filter((ws) => {
      if (status !== undefined && status !== '' && String(ws.status) !== status) {
        return false
      }
      if (!keyword) return true
      return (
        ws.name.toLowerCase().includes(keyword) ||
        ws.slug.toLowerCase().includes(keyword)
      )
    })
  }, [workspaces, globalFilter, statusFilter])

  const pageItems = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filtered.slice(start, start + pagination.pageSize)
  }, [filtered, pagination.pageIndex, pagination.pageSize])

  const { table } = useDataTable({
    data: pageItems,
    columns,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: filtered.length,
    ensurePageInRange,
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
    />
  )
}
