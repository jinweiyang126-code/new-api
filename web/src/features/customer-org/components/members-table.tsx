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

import {
  getCustomerMembers,
  getWorkspaceMembers,
  getWorkspaceMembersQuiet,
  getWorkspaceOrgWalletsQuiet,
} from '../api'
import { useCustomerContext } from '../hooks/use-customer-context'
import { apiErrorMessage } from '../lib/api-message'
import { CREDENTIAL_STATUS, getCredentialStatusOptions } from '../constants'
import { ORG_FILTER_ALL } from './org-scope-filters'
import { MembersBulkActions } from './members-bulk-actions'
import { useMembersColumns } from './members-columns'
import { type MemberRow, useMembers } from './members-provider'

const route = getRouteApi('/_authenticated/members/$section')

const SORTABLE = new Set([
  'id',
  'username',
  'role',
  'status',
  'created_at',
  'workspace_names',
  'org_wallet_balance',
])

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
    case 'workspace_names': {
      const av = a.workspace_names.join(', ')
      const bv = b.workspace_names.join(', ')
      return av.localeCompare(bv) * dir
    }
    case 'org_wallet_balance': {
      const av = a.org_wallet_balance ?? 0
      const bv = b.org_wallet_balance ?? 0
      return (av - bv) * dir
    }
    default:
      return (a.id - b.id) * dir
  }
}

export function MembersTable() {
  const { t } = useTranslation()
  const columns = useMembersColumns()
  const { data: ctx } = useCustomerContext()
  const {
    customerId,
    refreshTrigger,
    isPersonal,
    isAdmin,
    currentWorkspaceId,
    currentWorkspaceName,
  } = useMembers()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sorting, setSorting] = useState<SortingState>([])

  const workspaces = useMemo(
    () => ctx?.workspaces ?? [],
    [ctx?.workspaces]
  )

  const workspaceFilterOptions = useMemo(
    () => [
      { label: t('All'), value: ORG_FILTER_ALL },
      ...workspaces.map((ws) => ({
        label: ws.name,
        value: String(ws.id),
      })),
    ],
    [t, workspaces]
  )

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
      { columnId: 'workspace_id', searchKey: 'mWorkspace', type: 'array' },
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
      isAdmin,
      currentWorkspaceId,
      refreshTrigger,
      workspaces.map((ws) => ws.id).join(','),
    ],
    enabled: customerId > 0 && (isPersonal || currentWorkspaceId > 0),
    queryFn: async (): Promise<MemberRow[]> => {
      if (isPersonal) {
        const [customerRes, ...workspaceResults] = await Promise.all([
          getCustomerMembers(customerId),
          ...workspaces.map(async (ws) => {
            const [membersRes, walletsRes] = await Promise.all([
              getWorkspaceMembersQuiet(ws.id),
              isAdmin
                ? getWorkspaceOrgWalletsQuiet(ws.id)
                : Promise.resolve({ success: false as const, message: '' }),
            ])
            return { workspace: ws, membersRes, walletsRes }
          }),
        ])

        if (!customerRes.success) {
          toast.error(
            apiErrorMessage(t, customerRes.message, 'Failed to load members')
          )
          return []
        }

        const namesByUserId = new Map<number, string[]>()
        const idsByUserId = new Map<number, number[]>()
        const balanceByUserId = new Map<number, number>()
        for (const { workspace, membersRes, walletsRes } of workspaceResults) {
          if (membersRes.success && membersRes.data) {
            for (const member of membersRes.data) {
              const existing = namesByUserId.get(member.user_id) ?? []
              if (!existing.includes(workspace.name)) {
                namesByUserId.set(member.user_id, [...existing, workspace.name])
              }
              const existingIds = idsByUserId.get(member.user_id) ?? []
              if (!existingIds.includes(workspace.id)) {
                idsByUserId.set(member.user_id, [...existingIds, workspace.id])
              }
            }
          }
          if (walletsRes.success && walletsRes.data) {
            for (const wallet of walletsRes.data) {
              const existing = balanceByUserId.get(wallet.user_id) ?? 0
              balanceByUserId.set(
                wallet.user_id,
                existing + (wallet.balance ?? 0)
              )
            }
          }
        }

        return (customerRes.data ?? []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          username: m.username,
          role: m.role,
          status: m.status,
          created_at: m.created_at,
          scope: 'customer' as const,
          workspace_names: namesByUserId.get(m.user_id) ?? [],
          workspace_ids: idsByUserId.get(m.user_id) ?? [],
          org_wallet_balance: balanceByUserId.get(m.user_id) ?? 0,
        }))
      }

      const [membersRes, walletsRes] = await Promise.all([
        getWorkspaceMembers(currentWorkspaceId),
        isAdmin
          ? getWorkspaceOrgWalletsQuiet(currentWorkspaceId)
          : Promise.resolve({ success: false as const, message: '' }),
      ])
      if (!membersRes.success) {
        toast.error(apiErrorMessage(t, membersRes.message, 'Failed to load members'))
        return []
      }
      const balanceByUserId = new Map<number, number>()
      if (walletsRes.success && walletsRes.data) {
        for (const wallet of walletsRes.data) {
          balanceByUserId.set(wallet.user_id, wallet.balance ?? 0)
        }
      }
      const workspaceName = currentWorkspaceName || `#${currentWorkspaceId}`
      return (membersRes.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        username: m.username,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        scope: 'workspace' as const,
        workspace_names: workspaceName ? [workspaceName] : [],
        workspace_ids: currentWorkspaceId > 0 ? [currentWorkspaceId] : [],
        org_wallet_balance: balanceByUserId.get(m.user_id) ?? 0,
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
      const workspacesLabel = m.workspace_names.join(', ').toLowerCase()
      return (
        name.includes(keyword) ||
        m.role.toLowerCase().includes(keyword) ||
        workspacesLabel.includes(keyword)
      )
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
    initialColumnVisibility: { id: false },
    columnVisibilityStorageKey: 'members-column-visibility',
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
          ? t(
              'Select a workspace filter to view its members, or keep All for the organization-wide list.'
            )
          : t('Invite people to collaborate in this organization.')
      }
      skeletonKeyPrefix='members-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by username or role...'),
        searchDebounceMs: 300,
        filters: [
          {
            columnId: 'workspace_id',
            title: t('Workspace'),
            options: workspaceFilterOptions,
            singleSelect: true,
          },
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
              { label: t('Owner'), value: 'owner' },
              { label: t('Admin'), value: 'admin' },
              { label: t('Member'), value: 'member' },
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
