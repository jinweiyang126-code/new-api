/*
Copyright (C) 2023-2026 QuantumNous
*/
export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

export type Customer = {
  id: number
  name: string
  slug: string
  status: number
  quota: number
  used_quota: number
  owner_user_id: number
  remark?: string
  upstream_mode: string
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

export type CustomerMember = {
  id: number
  customer_id: number
  user_id: number
  role: string
  status: number
  username?: string
  created_at: number
  updated_at: number
}

export type Invitation = {
  id: number
  customer_id: number
  workspace_id?: number | null
  email: string
  token: string
  role: string
  workspace_role: string
  invited_by: number
  status: string
  expires_at: number
  created_at: number
  updated_at: number
  email_sent?: boolean
  email_error?: string
}

export type UpstreamCredential = {
  id: number
  customer_id: number
  name: string
  type: string
  base_url: string
  key_hint: string
  models: string
  priority: number
  status: number
  created_by: number
  rotated_at: number
  created_at: number
  updated_at: number
}

export type SelfCustomerContext = {
  customer: Customer | null
  role: string
  workspaces: Workspace[]
  is_admin: boolean
  current_workspace_id: number
}
