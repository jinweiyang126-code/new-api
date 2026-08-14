/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Table } from '@tanstack/react-table'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { Customer } from '../types'

export function DataTableBulkActions({
  table,
}: {
  table: Table<Customer>
}) {
  return (
    <BulkActionsToolbar table={table} entityName='customer'>
      {null}
    </BulkActionsToolbar>
  )
}
