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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '@/features/auth/auth-layout'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthCard } from '@/features/auth/components/auth-card'
import { useAuthChrome } from '@/features/auth/lib/auth-chrome-context'

import {
  SignupOnboardingForm,
  type OnboardingStep,
} from './components/signup-onboarding-form'

type SignupOnboardingProps = {
  initialStep?: OnboardingStep
}

export function SignupOnboarding({ initialStep = 'choose' }: SignupOnboardingProps) {
  return (
    <AuthLayout>
      <SignupOnboardingContent initialStep={initialStep} />
    </AuthLayout>
  )
}

function SignupOnboardingContent({
  initialStep = 'choose',
}: SignupOnboardingProps) {
  const { t } = useTranslation()
  const { setAction: setAuthChromeAction } = useAuthChrome()
  const [step, setStep] = useState<OnboardingStep>(initialStep)
  const isChoose = step === 'choose'

  const goBackToChoose = useCallback(() => {
    setStep('choose')
  }, [])

  useEffect(() => {
    if (step === 'organization') {
      setAuthChromeAction({
        label: t('Back'),
        onClick: goBackToChoose,
      })
      return () => setAuthChromeAction(null)
    }
    setAuthChromeAction(null)
    return () => setAuthChromeAction(null)
  }, [step, setAuthChromeAction, t, goBackToChoose])

  return (
    <AuthCard className='flex w-full max-w-[360px] flex-col items-center gap-6'>
      <div className='flex w-full flex-col items-center gap-4'>
        <AuthBrand />
        <div className='flex flex-col items-center gap-2 text-center'>
          <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
            {isChoose
              ? t('How will you be using the platform?')
              : t('Complete your organization information')}
          </h1>
          {isChoose ? (
            <p className='text-muted-foreground text-xs leading-5'>
              {t(
                'Choose the type of account you want to create, you can change this later.'
              )}
            </p>
          ) : null}
        </div>
      </div>
      <SignupOnboardingForm
        step={step}
        onStepChange={setStep}
        className='w-full'
      />
    </AuthCard>
  )
}
