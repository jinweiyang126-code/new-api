/*
Copyright (C) 2023-2026 QuantumNous
*/
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

import { getCustomers } from '../api'
import { CUSTOMER_STATUS } from '../constants'
import { useCustomersColumns } from './customers-columns'
import { useCustomers } from './customers-provider'

const route = getRouteApi('/_authenticated/customers/')

export function CustomersTable() {
  const { t } = useTranslation()
  const columns = useCustomersColumns()
  const { refreshTrigger } = useCustomers()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search: route.useSearch(),
      navigate: route.useNavigate(),
      pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'customers',
      pagination.pageIndex + 1,
      pagination.pageSize,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await getCustomers({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      })
      if (!result.success) {
        toast.error(result.message || t('Failed to load customers'))
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Customers Found')}
      emptyDescription={t('Create a customer to get started.')}
      skeletonKeyPrefix='customers-skeleton'
      applyHeaderSize
      getRowClassName={(row, { isMobile: mobile }) =>
        row.original.status === CUSTOMER_STATUS.DISABLED
          ? mobile
            ? DISABLED_ROW_MOBILE
            : DISABLED_ROW_DESKTOP
          : undefined
      }
    />
  )
}
