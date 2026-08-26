/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'

import type {
  ApiResponse,
  Customer,
  CustomerMember,
  Invitation,
  SelfCustomerContext,
  UpstreamCredential,
  Workspace,
  WorkspaceMember,
} from './types'

export async function createSelfCustomer(data: {
  organization_name: string
  invite_emails?: string[]
}): Promise<ApiResponse<{ customer_id: number; workspace_id: number }>> {
  const res = await api.post('/api/customers/self', data)
  return res.data
}

export async function getSelfCustomer(): Promise<
  ApiResponse<SelfCustomerContext>
> {
  const res = await api.get('/api/user/self/customer')
  return res.data
}

export async function setCurrentWorkspace(
  workspaceId: number
): Promise<ApiResponse<{ current_workspace_id: number }>> {
  const res = await api.post(
    '/api/user/self/current-workspace',
    { workspace_id: workspaceId },
    { skipBusinessError: true }
  )
  return res.data
}

export async function setCurrentCustomer(
  customerId: number
): Promise<
  ApiResponse<{ customer_id: number; current_workspace_id: number }>
> {
  const res = await api.post(
    '/api/user/self/current-customer',
    { customer_id: customerId },
    { skipBusinessError: true }
  )
  return res.data
}

export async function getCustomerWorkspaces(
  customerId: number
): Promise<ApiResponse<Workspace[]>> {
  const res = await api.get(`/api/customers/${customerId}/workspaces`)
  return res.data
}

export async function getWorkspace(
  workspaceId: number
): Promise<ApiResponse<Workspace>> {
  const res = await api.get(`/api/workspaces/${workspaceId}`)
  return res.data
}

export async function getWorkspaceMembers(
  workspaceId: number
): Promise<ApiResponse<WorkspaceMember[]>> {
  const res = await api.get(`/api/workspaces/${workspaceId}/members`)
  return res.data
}

export async function createWorkspace(
  customerId: number,
  data: { name: string; slug?: string }
): Promise<ApiResponse<Workspace>> {
  const res = await api.post(`/api/customers/${customerId}/workspaces`, data, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateWorkspace(
  workspaceId: number,
  data: { name?: string; status?: number; quota_limit?: number }
): Promise<ApiResponse<Workspace>> {
  const res = await api.put(`/api/workspaces/${workspaceId}`, data, {
    skipBusinessError: true,
  })
  return res.data
}

export async function transferQuota(
  workspaceId: number,
  amount: number
): Promise<ApiResponse> {
  const res = await api.post(
    `/api/workspaces/${workspaceId}/transfer-quota`,
    { amount },
    { skipBusinessError: true }
  )
  return res.data
}

export async function getCustomerMembers(
  customerId: number
): Promise<ApiResponse<CustomerMember[]>> {
  const res = await api.get(`/api/customers/${customerId}/members`)
  return res.data
}

export async function removeCustomerMember(
  customerId: number,
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/customers/${customerId}/members/${userId}`,
    { skipBusinessError: true }
  )
  return res.data
}

export async function removeWorkspaceMember(
  workspaceId: number,
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/workspaces/${workspaceId}/members/${userId}`,
    { skipBusinessError: true }
  )
  return res.data
}

export async function getCustomerInvitations(
  customerId: number
): Promise<ApiResponse<Invitation[]>> {
  const res = await api.get(`/api/customers/${customerId}/invitations`)
  return res.data
}

export async function createCustomerInvitation(
  customerId: number,
  data: {
    email: string
    workspace_id?: number
    role?: string
    workspace_role?: string
    expires_at?: number
  }
): Promise<ApiResponse<Invitation>> {
  const res = await api.post(
    `/api/customers/${customerId}/invitations`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}

export async function revokeInvitation(
  invitationId: number
): Promise<ApiResponse<Invitation>> {
  const res = await api.post(
    `/api/invitations/${invitationId}/revoke`,
    undefined,
    { skipBusinessError: true }
  )
  return res.data
}

export async function acceptInvitation(
  token: string
): Promise<ApiResponse<Invitation>> {
  const res = await api.post(
    `/api/invitations/${encodeURIComponent(token)}/accept`,
    undefined,
    { skipBusinessError: true }
  )
  return res.data
}

export async function getUpstreamCredentials(
  customerId: number
): Promise<ApiResponse<UpstreamCredential[]>> {
  const res = await api.get(`/api/customers/${customerId}/upstream-credentials`)
  return res.data
}

export async function createUpstreamCredential(
  customerId: number,
  data: {
    name: string
    type: string
    key: string
    base_url?: string
    models?: string
    priority?: number
  }
): Promise<ApiResponse<UpstreamCredential>> {
  const res = await api.post(
    `/api/customers/${customerId}/upstream-credentials`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}

export async function reorderUpstreamCredentials(
  customerId: number,
  orderedIds: number[]
): Promise<ApiResponse<UpstreamCredential[]>> {
  const res = await api.put(
    `/api/customers/${customerId}/upstream-credentials/reorder`,
    { ordered_ids: orderedIds },
    { skipBusinessError: true }
  )
  return res.data
}

export async function updateUpstreamCredential(
  customerId: number,
  credentialId: number,
  data: {
    name?: string
    type?: string
    key?: string
    base_url?: string
    models?: string
    priority?: number
    status?: number
  }
): Promise<ApiResponse<UpstreamCredential>> {
  const res = await api.put(
    `/api/customers/${customerId}/upstream-credentials/${credentialId}`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}

export async function deleteUpstreamCredential(
  customerId: number,
  credentialId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/customers/${customerId}/upstream-credentials/${credentialId}`,
    { skipBusinessError: true }
  )
  return res.data
}

export async function testUpstreamCredential(
  customerId: number,
  credentialId: number
): Promise<ApiResponse<{ ok: boolean; message: string }>> {
  const res = await api.post(
    `/api/customers/${customerId}/upstream-credentials/${credentialId}/test`,
    undefined,
    { skipBusinessError: true }
  )
  return res.data
}

export async function fetchUpstreamCredentialModels(
  customerId: number,
  data: {
    type: string
    key?: string
    base_url?: string
    credential_id?: number
  }
): Promise<ApiResponse<string[]>> {
  const res = await api.post(
    `/api/customers/${customerId}/upstream-credentials/fetch-models`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}

export async function getCustomer(
  customerId: number
): Promise<ApiResponse<Customer>> {
  const res = await api.get(`/api/customers/${customerId}`)
  return res.data
}

export type OrgWallet = {
  id: number
  user_id: number
  customer_id: number
  workspace_id: number
  balance: number
  used_quota?: number
  request_count?: number
  created_at: number
  updated_at: number
  customer_name?: string
  workspace_name?: string
  username?: string
}

export type OrgWalletLedgerEntry = {
  id: number
  action: string
  amount: number
  workspace_id: number
  workspace_name?: string
  customer_id: number
  operator_id?: number
  created_at: number
}

export async function getSelfOrgWallets(
  customerId?: number
): Promise<ApiResponse<OrgWallet[]>> {
  const res = await api.get('/api/user/self/org-wallets', {
    params: customerId ? { customer_id: customerId } : undefined,
  })
  return res.data
}

export async function getSelfOrgWalletLedger(params: {
  customer_id?: number
  workspace_id?: number
  p?: number
  size?: number
}): Promise<ApiResponse<{ items: OrgWalletLedgerEntry[]; total: number }>> {
  const res = await api.get('/api/user/self/org-wallet-ledger', { params })
  return res.data
}

export async function getWorkspaceOrgWallets(
  workspaceId: number
): Promise<ApiResponse<OrgWallet[]>> {
  const res = await api.get(`/api/workspaces/${workspaceId}/org-wallets`)
  return res.data
}

export async function allocateOrgWallet(
  workspaceId: number,
  data: { user_id: number; amount: number }
): Promise<ApiResponse<OrgWallet>> {
  const res = await api.post(
    `/api/workspaces/${workspaceId}/org-wallets/allocate`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}

export async function revokeOrgWallet(
  workspaceId: number,
  data: { user_id: number; amount: number }
): Promise<ApiResponse<OrgWallet>> {
  const res = await api.post(
    `/api/workspaces/${workspaceId}/org-wallets/revoke`,
    data,
    { skipBusinessError: true }
  )
  return res.data
}
