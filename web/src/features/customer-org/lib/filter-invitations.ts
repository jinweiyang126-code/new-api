/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Invitation } from '../types'

/** Scope invitations to the page workspace filter (All vs one workspace). */
export function filterInvitationsByWorkspace(
  invitations: Invitation[],
  opts: {
    showAll: boolean
    workspaceId: number
    isDefaultWorkspace: boolean
  }
): Invitation[] {
  if (opts.showAll) return invitations
  return invitations.filter((inv) => {
    if (inv.workspace_id == null || inv.workspace_id === 0) {
      return opts.isDefaultWorkspace
    }
    return inv.workspace_id === opts.workspaceId
  })
}
