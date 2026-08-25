/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSelfCustomer } from '@/features/customer-org/api'
import { OrgWalletPage } from '@/features/customer-org/org-wallet-page'

export const Route = createFileRoute('/_authenticated/org-wallet/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer) {
      throw redirect({ to: '/403' })
    }
  },
  component: OrgWalletPage,
})
