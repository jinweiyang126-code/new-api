/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Table } from '@tanstack/react-table'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { Workspace } from '../types'

export function WorkspacesBulkActions({
  table,
}: {
  table: Table<Workspace>
}) {
  return (
    <BulkActionsToolbar table={table} entityName='workspace'>
      {null}
    </BulkActionsToolbar>
  )
}
