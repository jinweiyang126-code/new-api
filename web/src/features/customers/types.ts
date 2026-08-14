/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { CUSTOMER_STATUS, UPSTREAM_MODE } from './constants'

export type CustomerStatus =
  (typeof CUSTOMER_STATUS)[keyof typeof CUSTOMER_STATUS]
export type UpstreamMode = (typeof UPSTREAM_MODE)[keyof typeof UPSTREAM_MODE]

export type Customer = {
  id: number
  name: string
  slug: string
  status: CustomerStatus
  quota: number
  used_quota: number
  owner_user_id: number
  owner_username?: string
  remark?: string
  upstream_mode: UpstreamMode | string
  allow_global_fallback: boolean
  byok_enabled: boolean
  created_at: number
  updated_at: number
}

export type Workspace = {
  id: number
  customer_id: number
  name: string
  slug: string
  status: number
  quota: number
  used_quota: number
  is_default: boolean
  created_at: number
  updated_at: number
}

export type ChannelBinding = {
  id: number
  customer_id: number
  channel_id: number
  priority: number
  model_mapping?: string
  status: number
  created_at: number
  updated_at: number
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

export type GetCustomersResponse = ApiResponse<{
  items: Customer[]
  total: number
  page: number
  page_size: number
}>

export type CreateCustomerPayload = {
  name: string
  slug?: string
  remark?: string
  owner_user_id: number
}

export type CreateCustomerResult = {
  customer: Customer
  workspace: Workspace
}

export type UpstreamSettingsPayload = {
  upstream_mode?: string
  allow_global_fallback?: boolean
  byok_enabled?: boolean
}
