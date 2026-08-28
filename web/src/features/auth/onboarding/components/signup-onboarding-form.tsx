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

type OnboardingStep = 'choose' | 'organization'

type SignupOnboardingFormProps = {
  initialStep?: OnboardingStep
  className?: string
}

export function SignupOnboardingForm({
  initialStep = 'choose',
  className,
}: SignupOnboardingFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentCustomer = useSetCurrentCustomer()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [step, setStep] = useState<OnboardingStep>(initialStep)
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
      <div className={cn('grid gap-4', className)}>
        <p className='text-muted-foreground text-sm'>
          {t('Choose the type of account you want to create')}
        </p>
        <p className='text-muted-foreground text-xs'>
          {t('You can change this later.')}
        </p>
        <Button
          type='button'
          variant='outline'
          className='h-auto w-full justify-start gap-3 rounded-lg px-4 py-4 text-left'
          disabled={isLoading}
          onClick={() => finishPersonal()}
        >
          <User className='text-muted-foreground h-5 w-5 shrink-0' />
          <span className='flex flex-col gap-0.5'>
            <span className='font-medium'>{t('Personal account')}</span>
            <span className='text-muted-foreground text-xs font-normal'>
              {t('Use your personal wallet for API usage')}
            </span>
          </span>
        </Button>
        <Button
          type='button'
          variant='outline'
          className='h-auto w-full justify-start gap-3 rounded-lg px-4 py-4 text-left'
          disabled={isLoading}
          onClick={() => setStep('organization')}
        >
          <Building2 className='text-muted-foreground h-5 w-5 shrink-0' />
          <span className='flex flex-col gap-0.5'>
            <span className='font-medium'>{t('Organization account')}</span>
            <span className='text-muted-foreground text-xs font-normal'>
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
      className={cn('grid gap-4', className)}
    >
      <OrganizationSetupFields
        organizationName={organizationName}
        onOrganizationNameChange={setOrganizationName}
        inviteEmails={inviteEmails}
        onInviteEmailsChange={setInviteEmails}
        disabled={isLoading}
      />
      <div className='mt-2 flex gap-2'>
        <Button
          type='button'
          variant='outline'
          className='flex-1'
          disabled={isLoading}
          onClick={() => setStep('choose')}
        >
          {t('Back')}
        </Button>
        <AuthSubmitButton
          type='submit'
          className='flex-1'
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {t('Create organization')}
        </AuthSubmitButton>
      </div>
    </form>
  )
}
