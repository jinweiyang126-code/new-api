/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSelfCustomer } from '@/features/customer-org/api'
import { MEMBERS_DEFAULT_SECTION } from '@/features/customer-org/section-registry'

export const Route = createFileRoute('/_authenticated/members/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer) {
      throw redirect({ to: '/403' })
    }

    throw redirect({
      to: '/members/$section',
      params: { section: MEMBERS_DEFAULT_SECTION },
    })
  },
})
