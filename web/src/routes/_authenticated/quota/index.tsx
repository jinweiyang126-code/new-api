/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSelfCustomer } from '@/features/customer-org/api'
import { QuotaPage } from '@/features/customer-org/quota-page'

export const Route = createFileRoute('/_authenticated/quota/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer || !res.data.is_admin) {
      throw redirect({ to: '/403' })
    }
  },
  component: QuotaPage,
})
