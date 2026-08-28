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
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '@/features/auth/auth-layout'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthCard } from '@/features/auth/components/auth-card'

import { SignupOnboardingForm } from './components/signup-onboarding-form'

type SignupOnboardingProps = {
  initialStep?: 'choose' | 'organization'
}

export function SignupOnboarding({ initialStep }: SignupOnboardingProps) {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <AuthCard className='w-full max-w-[420px] space-y-6'>
        <AuthBrand />
        <div className='space-y-2 text-center'>
          <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
            {initialStep === 'organization'
              ? t('Set up your organization')
              : t('Welcome')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {initialStep === 'organization'
              ? t('Invite teammates (optional)')
              : t('How will you be using the platform?')}
          </p>
        </div>
        <SignupOnboardingForm initialStep={initialStep ?? 'choose'} />
      </AuthCard>
    </AuthLayout>
  )
}
