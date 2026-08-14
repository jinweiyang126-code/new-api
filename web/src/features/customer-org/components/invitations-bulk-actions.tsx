/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Table } from '@tanstack/react-table'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { Invitation } from '../types'

export function InvitationsBulkActions({
  table,
}: {
  table: Table<Invitation>
}) {
  return (
    <BulkActionsToolbar table={table} entityName='invitation'>
      {null}
    </BulkActionsToolbar>
  )
}
