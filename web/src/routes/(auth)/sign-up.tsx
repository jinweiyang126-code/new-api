/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { createFileRoute, redirect } from '@tanstack/react-router'

import { SignUp } from '@/features/auth/sign-up'
import { useAuthStore } from '@/stores/auth-store'

type SignUpSearch = {
  setup?: 'organization'
  invite?: string
  aff?: string
}

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUpRoute,
  validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
    setup: search.setup === 'organization' ? 'organization' : undefined,
    invite: typeof search.invite === 'string' ? search.invite : undefined,
    aff: typeof search.aff === 'string' ? search.aff : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { auth } = useAuthStore.getState()

    if (!auth.user) return

    const needsOrgSetup =
      search.setup === 'organization' && !auth.user.customer_id
    if (needsOrgSetup) return

    throw redirect({ to: '/dashboard' })
  },
})

function SignUpRoute() {
  const search = Route.useSearch()
  return <SignUp setup={search.setup} invite={search.invite} />
}
