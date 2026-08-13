/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { Customers } from '@/features/customers'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const customersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/customers/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.SUPER_ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  validateSearch: customersSearchSchema,
  component: Customers,
})
