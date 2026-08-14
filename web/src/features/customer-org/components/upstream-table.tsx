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

import { getUpstreamCredentials } from '../api'
import { CREDENTIAL_STATUS, getCredentialStatusOptions } from '../constants'
import type { UpstreamCredential } from '../types'
import { UpstreamBulkActions } from './upstream-bulk-actions'
import { useUpstreamColumns } from './upstream-columns'
import { useUpstream } from './upstream-provider'

const route = getRouteApi('/_authenticated/upstream/')

const SORTABLE = new Set([
  'id',
  'name',
  'type',
  'base_url',
  'priority',
  'status',
  'updated_at',
])

function compareCredentials(
  a: UpstreamCredential,
  b: UpstreamCredential,
  sortBy: string,
  desc: boolean
) {
  const dir = desc ? -1 : 1
  switch (sortBy) {
    case 'id':
    case 'priority':
    case 'status':
    case 'updated_at': {
      const av = Number(a[sortBy as keyof UpstreamCredential] ?? 0)
      const bv = Number(b[sortBy as keyof UpstreamCredential] ?? 0)
      return (av - bv) * dir
    }
    case 'name':
    case 'type':
    case 'base_url': {
      const av = String(a[sortBy as keyof UpstreamCredential] ?? '')
      const bv = String(b[sortBy as keyof UpstreamCredential] ?? '')
      return av.localeCompare(bv) * dir
    }
    default:
      return (a.id - b.id) * dir
  }
}

export function UpstreamTable() {
  const { t } = useTranslation()
  const columns = useUpstreamColumns()
  const { customerId, refreshTrigger } = useUpstream()
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

  const { data: credentials = [], isLoading, isFetching } = useQuery({
    queryKey: ['upstream-credentials', customerId, refreshTrigger],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getUpstreamCredentials(customerId)
      if (!res.success) {
        toast.error(res.message || t('Failed to load credentials'))
        return []
      }
      return res.data ?? []
    },
    placeholderData: (prev) => prev,
  })

  const filtered = useMemo(() => {
    const keyword = globalFilter?.trim().toLowerCase() ?? ''
    const rows = credentials.filter((cred) => {
      if (statusValue !== '' && String(cred.status) !== statusValue) {
        return false
      }
      if (!keyword) return true
      return (
        cred.name.toLowerCase().includes(keyword) ||
        cred.type.toLowerCase().includes(keyword) ||
        (cred.base_url || '').toLowerCase().includes(keyword) ||
        (cred.models || '').toLowerCase().includes(keyword) ||
        (cred.key_hint || '').toLowerCase().includes(keyword)
      )
    })

    const activeSort = sorting[0]
    if (activeSort && SORTABLE.has(activeSort.id)) {
      return [...rows].sort((a, b) =>
        compareCredentials(a, b, activeSort.id, activeSort.desc)
      )
    }
    return rows
  }, [credentials, globalFilter, statusValue, sorting])

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
      emptyTitle={t('No credentials')}
      emptyDescription={t('Add a BYOK credential to get started.')}
      skeletonKeyPrefix='upstream-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name, type, or URL...'),
        searchDebounceMs: 300,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: getCredentialStatusOptions(t),
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
      bulkActions={<UpstreamBulkActions table={table} />}
    />
  )
}
