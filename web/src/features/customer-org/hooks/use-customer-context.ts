/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAuthStore } from '@/stores/auth-store'

import {
  getSelfCustomer,
  setCurrentCustomer,
  setCurrentWorkspace,
} from '../api'
import type { SelfCustomerContext } from '../types'

export const SELF_CUSTOMER_QUERY_KEY = ['self-customer'] as const

export function useCustomerContext(enabled = true) {
  const setCustomerContext = useAuthStore((s) => s.auth.setCustomerContext)
  const query = useQuery({
    queryKey: SELF_CUSTOMER_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<SelfCustomerContext> => {
      const res = await getSelfCustomer()
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to load customer context')
      }
      return {
        ...res.data,
        current_workspace_id: res.data.current_workspace_id ?? 0,
        workspaces: res.data.workspaces ?? [],
        customers: res.data.customers ?? [],
      }
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (query.data) {
      setCustomerContext(query.data)
    } else if (!enabled || query.isError) {
      setCustomerContext(null)
    }
  }, [query.data, query.isError, enabled, setCustomerContext])

  return query
}

export function useSetCurrentWorkspace() {
  const queryClient = useQueryClient()
  const setCustomerContext = useAuthStore((s) => s.auth.setCustomerContext)

  return useMutation({
    mutationFn: async (workspaceId: number) => {
      const res = await setCurrentWorkspace(workspaceId)
      if (!res.success) {
        throw new Error(res.message || 'Failed to switch workspace')
      }
      return res.data?.current_workspace_id ?? workspaceId
    },
    onSuccess: (workspaceId) => {
      queryClient.setQueryData<SelfCustomerContext>(
        SELF_CUSTOMER_QUERY_KEY,
        (prev) =>
          prev
            ? { ...prev, current_workspace_id: workspaceId }
            : prev
      )
      const prev = useAuthStore.getState().auth.customerContext
      if (prev) {
        setCustomerContext({ ...prev, current_workspace_id: workspaceId })
      }
      void queryClient.invalidateQueries({ queryKey: SELF_CUSTOMER_QUERY_KEY })
    },
  })
}


export function useSetCurrentCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customerId: number) => {
      const res = await setCurrentCustomer(customerId)
      if (!res.success) {
        throw new Error(res.message || 'Failed to switch customer')
      }
      return res.data?.customer_id ?? customerId
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SELF_CUSTOMER_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['customer-members'] })
      void queryClient.invalidateQueries({ queryKey: ['customer-invitations'] })
      void queryClient.invalidateQueries({ queryKey: ['customer-workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['self-org-wallets'] })
    },
  })
}

export function isCustomerAdminRole(role?: string | null) {
  return role === 'owner' || role === 'admin'
}
