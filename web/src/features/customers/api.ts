/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'

import type {
  ApiResponse,
  ChannelBinding,
  CreateCustomerPayload,
  CreateCustomerResult,
  Customer,
  GetCustomersResponse,
  UpstreamSettingsPayload,
  Workspace,
} from './types'

export async function getCustomers(params: {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  sort_by?: string
  sort_order?: string
}): Promise<GetCustomersResponse> {
  const res = await api.get('/api/customers/', {
    params: {
      p: params.p ?? 1,
      page_size: params.page_size ?? 20,
      keyword: params.keyword || undefined,
      status: params.status || undefined,
      sort_by: params.sort_by || undefined,
      sort_order: params.sort_order || undefined,
    },
  })
  return res.data
}

export async function getCustomer(
  id: number
): Promise<ApiResponse<Customer>> {
  const res = await api.get(`/api/customers/${id}`)
  return res.data
}

export async function createCustomer(
  data: CreateCustomerPayload
): Promise<ApiResponse<CreateCustomerResult>> {
  const res = await api.post('/api/customers/', data, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateCustomer(
  id: number,
  data: { name?: string; remark?: string; status?: number }
): Promise<ApiResponse<Customer>> {
  const res = await api.put(`/api/customers/${id}`, data)
  return res.data
}

export async function topupCustomer(
  id: number,
  amount: number
): Promise<ApiResponse<Customer>> {
  const res = await api.post(`/api/customers/${id}/topup`, { amount })
  return res.data
}

export async function getCustomerWorkspaces(
  id: number
): Promise<ApiResponse<Workspace[]>> {
  const res = await api.get(`/api/customers/${id}/workspaces`)
  return res.data
}

export async function updateUpstreamSettings(
  id: number,
  data: UpstreamSettingsPayload
): Promise<ApiResponse<Customer>> {
  const res = await api.put(`/api/customers/${id}/upstream-settings`, data)
  return res.data
}

export async function getChannelBindings(
  id: number
): Promise<ApiResponse<ChannelBinding[]>> {
  const res = await api.get(`/api/customers/${id}/channel-bindings`)
  return res.data
}

export async function createChannelBinding(
  id: number,
  data: { channel_id: number; priority?: number; model_mapping?: string }
): Promise<ApiResponse<ChannelBinding>> {
  const res = await api.post(`/api/customers/${id}/channel-bindings`, data)
  return res.data
}

export async function reorderChannelBindings(
  customerId: number,
  orderedIds: number[]
): Promise<ApiResponse<ChannelBinding[]>> {
  const res = await api.put(`/api/customers/${customerId}/channel-bindings/reorder`, {
    ordered_ids: orderedIds,
  })
  return res.data
}

export async function deleteChannelBinding(
  customerId: number,
  bindingId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/customers/${customerId}/channel-bindings/${bindingId}`
  )
  return res.data
}
