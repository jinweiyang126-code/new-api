/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { getSelfCustomer } from '@/features/customer-org/api'
import { UpstreamPage } from '@/features/customer-org/upstream-page'

const upstreamSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(undefined),
  filter: z.string().optional().catch(''),
  status: z.array(z.string()).optional().catch([]),
})

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
  validateSearch: upstreamSearchSchema,
  component: UpstreamPage,
})
