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
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Loader2, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button'
import { createSelfCustomer } from '@/features/customer-org/api'
import {
  SELF_CUSTOMER_QUERY_KEY,
  useSetCurrentCustomer,
} from '@/features/customer-org/hooks/use-customer-context'
import { OrganizationSetupFields } from '@/features/auth/sign-up/components/organization-setup-fields'
import { clearSignupOnboardingPending } from '@/features/auth/lib/signup-onboarding'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const accountTypeCardClassName =
  'h-auto w-full justify-start gap-3 rounded-[12px] border border-solid border-[#E5E5E7] bg-white px-4 py-4 text-left font-normal shadow-none hover:bg-white dark:border-[#2E2E2E] dark:bg-[#212121] dark:hover:bg-[#212121]'

type InviteEmailField = {
  key: string
  value: string
}

function createInviteField(value = ''): InviteEmailField {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value,
  }
}

export type OnboardingStep = 'choose' | 'organization'

type SignupOnboardingFormProps = {
  step: OnboardingStep
  onStepChange: (step: OnboardingStep) => void
  className?: string
}

export function SignupOnboardingForm({
  step,
  onStepChange,
  className,
}: SignupOnboardingFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentCustomer = useSetCurrentCustomer()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [isLoading, setIsLoading] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [inviteEmails, setInviteEmails] = useState([createInviteField()])

  useEffect(() => {
    if (user?.customer_id && user.customer_id > 0) {
      clearSignupOnboardingPending()
      void navigate({ to: '/dashboard', replace: true })
    }
  }, [user, navigate])

  function collectInviteEmails(): string[] | null {
    const cleaned = inviteEmails
      .map((field) => field.value.trim())
      .filter(Boolean)
    for (const email of cleaned) {
      if (!INVITE_EMAIL_RE.test(email)) {
        toast.error(t('Invalid email'))
        return null
      }
    }
    return cleaned
  }

  function finishPersonal() {
    clearSignupOnboardingPending()
    toast.success(t('Welcome!'))
    void navigate({ to: '/dashboard', replace: true })
  }

  async function submitOrganization() {
    const name = organizationName.trim()
    if (!name) {
      toast.error(t('Please enter your organization name'))
      return
    }
    const emails = collectInviteEmails()
    if (!emails) return

    setIsLoading(true)
    try {
      const res = await createSelfCustomer({
        organization_name: name,
        invite_emails: emails,
      })
      if (!res?.success || !res.data?.customer_id) {
        toast.error(res?.message || t('Failed to create organization'))
        return
      }
      // Sidebar org menus gate on self-customer context, not user.customer_id alone.
      // Refresh context before updating user.customer_id (that update can trigger redirect).
      clearSignupOnboardingPending()
      await queryClient.invalidateQueries({ queryKey: SELF_CUSTOMER_QUERY_KEY })
      await setCurrentCustomer.mutateAsync(res.data.customer_id)
      if (user) {
        setUser({ ...user, customer_id: res.data.customer_id })
      }
      toast.success(t('Organization created'))
      void navigate({ to: '/dashboard', replace: true })
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'choose') {
    return (
      <div className={cn('flex w-full flex-col gap-3', className)}>
        <Button
          type='button'
          variant='ghost'
          className={accountTypeCardClassName}
          disabled={isLoading}
          onClick={() => finishPersonal()}
        >
          <User className='size-5 shrink-0 text-foreground' />
          <span className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-sm font-medium text-foreground'>
              {t('Personal account')}
            </span>
            <span className='text-muted-foreground text-xs leading-5'>
              {t('Use your personal wallet for API usage')}
            </span>
          </span>
        </Button>
        <Button
          type='button'
          variant='ghost'
          className={accountTypeCardClassName}
          disabled={isLoading}
          onClick={() => onStepChange('organization')}
        >
          <Building2 className='size-5 shrink-0 text-foreground' />
          <span className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-sm font-medium text-foreground'>
              {t('Organization account')}
            </span>
            <span className='text-muted-foreground text-xs leading-5'>
              {t('Create an organization and invite teammates')}
            </span>
          </span>
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submitOrganization()
      }}
      className={cn('flex w-full flex-col gap-6', className)}
    >
      <OrganizationSetupFields
        organizationName={organizationName}
        onOrganizationNameChange={setOrganizationName}
        inviteEmails={inviteEmails}
        onInviteEmailsChange={setInviteEmails}
        disabled={isLoading}
      />
      <AuthSubmitButton type='submit' disabled={isLoading}>
        {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
        {t('Create organization')}
      </AuthSubmitButton>
    </form>
  )
}
