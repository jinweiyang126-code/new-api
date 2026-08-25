/*
Copyright (C) 2023-2026 QuantumNous
*/

/** Workspace-scoped keys display as `CustomerName-WorkspaceName`. */
export function formatWorkspaceTokenScopeLabel(
  customerName: string | undefined | null,
  workspaceName: string | undefined | null,
  workspaceId?: number
): string {
  const customer = customerName?.trim() || ''
  const workspace =
    workspaceName?.trim() ||
    (workspaceId && workspaceId > 0 ? `#${workspaceId}` : '')
  if (customer && workspace) return `${customer}-${workspace}`
  if (workspace) return workspace
  if (customer) return customer
  return ''
}
