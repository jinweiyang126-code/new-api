/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '@/features/auth/auth-layout'

import { SignupOnboardingForm } from './components/signup-onboarding-form'

type SignupOnboardingProps = {
  initialStep?: 'choose' | 'organization'
}

export function SignupOnboarding({ initialStep }: SignupOnboardingProps) {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {initialStep === 'organization'
              ? t('Set up your organization')
              : t('Welcome')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {initialStep === 'organization'
              ? t('Invite teammates (optional)')
              : t('How will you be using the platform?')}
          </p>
        </div>

        <SignupOnboardingForm initialStep={initialStep ?? 'choose'} />
      </div>
    </AuthLayout>
  )
}
