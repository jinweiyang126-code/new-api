/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { SelfCustomerContext, Workspace } from '../types'

export type ResolvedWorkspaceContext = {
  currentWorkspaceId: number
  /** null when personal (current_workspace_id === 0) or workspace missing */
  currentWorkspace: Workspace | null
  isPersonal: boolean
}

export function resolveCurrentWorkspace(
  ctx: SelfCustomerContext | null | undefined
): ResolvedWorkspaceContext {
  const currentWorkspaceId = ctx?.current_workspace_id ?? 0
  if (currentWorkspaceId <= 0) {
    return {
      currentWorkspaceId: 0,
      currentWorkspace: null,
      isPersonal: true,
    }
  }
  const currentWorkspace =
    (ctx?.workspaces ?? []).find((w) => w.id === currentWorkspaceId) ?? null
  return {
    currentWorkspaceId,
    currentWorkspace,
    isPersonal: false,
  }
}
