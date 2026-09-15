/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { SignupOnboarding } from '@/features/auth/onboarding'
import { useAuthStore } from '@/stores/auth-store'

type OnboardingSearch = {
  type?: 'organization'
  preview?: 'flow'
  theme?: 'light'
}

export const Route = createFileRoute('/(auth)/onboarding')({
  component: OnboardingRoute,
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    type: search.type === 'organization' ? 'organization' : undefined,
    preview: search.preview === 'flow' ? 'flow' : undefined,
    theme: search.theme === 'light' ? 'light' : undefined,
  }),
  beforeLoad: ({ location, search }) => {
    if (search.preview === 'flow') return
    const { auth } = useAuthStore.getState()
    if (!auth.user || !auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
})

function OnboardingRoute() {
  const search = Route.useSearch()
  return (
    <SignupOnboarding
      initialStep={search.type === 'organization' ? 'organization' : 'choose'}
      preview={search.preview === 'flow'}
    />
  )
}
