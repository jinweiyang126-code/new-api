/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSelfCustomer } from '@/features/customer-org/api'
import { UpstreamPage } from '@/features/customer-org/upstream-page'

export const Route = createFileRoute('/_authenticated/upstream/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (
      !res?.success ||
      !res.data?.customer ||
      !res.data.is_admin ||
      !res.data.customer.byok_enabled
    ) {
      throw redirect({ to: '/403' })
    }
  },
  component: UpstreamPage,
})
