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

export async function getSelfCustomer(): Promise<
  ApiResponse<SelfCustomerContext>
> {
  const res = await api.get('/api/user/self/customer')
  return res.data
}

export async function setCurrentWorkspace(
  workspaceId: number
): Promise<ApiResponse<{ current_workspace_id: number }>> {
  const res = await api.post('/api/user/self/current-workspace', {
    workspace_id: workspaceId,
  })
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
  const res = await api.post(`/api/customers/${customerId}/workspaces`, data)
  return res.data
}

export async function updateWorkspace(
  workspaceId: number,
  data: { name?: string; status?: number }
): Promise<ApiResponse<Workspace>> {
  const res = await api.put(`/api/workspaces/${workspaceId}`, data)
  return res.data
}

export async function transferQuota(
  workspaceId: number,
  amount: number
): Promise<ApiResponse> {
  const res = await api.post(`/api/workspaces/${workspaceId}/transfer-quota`, {
    amount,
  })
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
    `/api/customers/${customerId}/members/${userId}`
  )
  return res.data
}

export async function removeWorkspaceMember(
  workspaceId: number,
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/workspaces/${workspaceId}/members/${userId}`
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
  const res = await api.post(`/api/customers/${customerId}/invitations`, data)
  return res.data
}

export async function revokeInvitation(
  invitationId: number
): Promise<ApiResponse<Invitation>> {
  const res = await api.post(`/api/invitations/${invitationId}/revoke`)
  return res.data
}

export async function acceptInvitation(
  token: string
): Promise<ApiResponse<Invitation>> {
  const res = await api.post(`/api/invitations/${encodeURIComponent(token)}/accept`)
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
    data
  )
  return res.data
}

export async function reorderUpstreamCredentials(
  customerId: number,
  orderedIds: number[]
): Promise<ApiResponse<UpstreamCredential[]>> {
  const res = await api.put(
    `/api/customers/${customerId}/upstream-credentials/reorder`,
    { ordered_ids: orderedIds }
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
    data
  )
  return res.data
}

export async function deleteUpstreamCredential(
  customerId: number,
  credentialId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/customers/${customerId}/upstream-credentials/${credentialId}`
  )
  return res.data
}

export async function testUpstreamCredential(
  customerId: number,
  credentialId: number
): Promise<ApiResponse<{ ok: boolean; message: string }>> {
  const res = await api.post(
    `/api/customers/${customerId}/upstream-credentials/${credentialId}/test`
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
    data
  )
  return res.data
}

export async function getCustomer(
  customerId: number
): Promise<ApiResponse<Customer>> {
  const res = await api.get(`/api/customers/${customerId}`)
  return res.data
}
