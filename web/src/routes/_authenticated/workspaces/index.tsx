/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { getSelfCustomer } from '@/features/customer-org/api'
import { WorkspacesPage } from '@/features/customer-org/workspaces-page'

const workspacesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(undefined),
  filter: z.string().optional().catch(''),
  status: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/workspaces/')({
  beforeLoad: async () => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer) {
      throw redirect({ to: '/403' })
    }
  },
  validateSearch: workspacesSearchSchema,
  component: WorkspacesPage,
})
