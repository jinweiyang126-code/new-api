/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSelfCustomer } from '@/features/customer-org/api'
import { WorkspacesPage } from '@/features/customer-org/workspaces-page'

export const Route = createFileRoute('/_authenticated/workspaces/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer) {
      throw redirect({ to: '/403' })
    }
  },
  component: WorkspacesPage,
})
