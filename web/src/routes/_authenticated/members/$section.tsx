/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { getSelfCustomer } from '@/features/customer-org/api'
import { MembersPage } from '@/features/customer-org/members-page'
import {
  MEMBERS_DEFAULT_SECTION,
  MEMBERS_SECTION_IDS,
} from '@/features/customer-org/section-registry'

const membersSearchSchema = z.object({
  mPage: z.number().optional().catch(1),
  mPageSize: z.number().optional().catch(undefined),
  mFilter: z.string().optional().catch(''),
  mStatus: z.array(z.string()).optional().catch([]),
  mRole: z.array(z.string()).optional().catch([]),
  iPage: z.number().optional().catch(1),
  iPageSize: z.number().optional().catch(undefined),
  iFilter: z.string().optional().catch(''),
  iStatus: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/members/$section')({
  beforeLoad: async ({ params }) => {
    const res = await getSelfCustomer().catch(() => null)
    if (!res?.success || !res.data?.customer) {
      throw redirect({ to: '/403' })
    }

    const validSections = MEMBERS_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/members/$section',
        params: { section: MEMBERS_DEFAULT_SECTION },
      })
    }

    if (params.section === 'invitations' && !res.data?.is_admin) {
      throw redirect({
        to: '/members/$section',
        params: { section: MEMBERS_DEFAULT_SECTION },
      })
    }
  },
  validateSearch: membersSearchSchema,
  component: MembersPage,
})
