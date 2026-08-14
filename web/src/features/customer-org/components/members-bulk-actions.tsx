/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Table } from '@tanstack/react-table'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { MemberRow } from './members-provider'

export function MembersBulkActions({ table }: { table: Table<MemberRow> }) {
  return (
    <BulkActionsToolbar table={table} entityName='member'>
      {null}
    </BulkActionsToolbar>
  )
}
