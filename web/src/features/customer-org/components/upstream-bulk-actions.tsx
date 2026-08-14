/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Table } from '@tanstack/react-table'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { UpstreamCredential } from '../types'

export function UpstreamBulkActions({
  table,
}: {
  table: Table<UpstreamCredential>
}) {
  return (
    <BulkActionsToolbar table={table} entityName='credential'>
      {null}
    </BulkActionsToolbar>
  )
}
