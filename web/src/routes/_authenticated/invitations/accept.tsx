/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { AcceptInvitationPage } from '@/features/customer-org/accept-invitation-page'
import { useAuthStore } from '@/stores/auth-store'

const searchSchema = z.object({
  token: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/invitations/accept')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.user) {
      const token = search.token || ''
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: token
            ? `/invitations/accept?token=${encodeURIComponent(token)}`
            : '/invitations/accept',
        },
      })
    }
  },
  component: function AcceptInvitationRoute() {
    const { token } = Route.useSearch()
    return <AcceptInvitationPage initialToken={token || ''} />
  },
})
