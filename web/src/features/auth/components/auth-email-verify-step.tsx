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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { OTP_LENGTH } from '@/features/auth/constants'

import { AuthBrand } from './auth-brand'
import { AuthCard } from './auth-card'
import { AuthSubmitButton } from './auth-submit-button'

type AuthEmailVerifyStepProps = {
  email: string
  code: string
  onCodeChange: (value: string) => void
  onSubmit: () => void
  onResend: () => void
  isSubmitting: boolean
  isSending: boolean
  secondsLeft: number
  isResendActive: boolean
}

export function AuthEmailVerifyStep({
  email,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  isSubmitting,
  isSending,
  secondsLeft,
  isResendActive,
}: AuthEmailVerifyStepProps) {
  const { t } = useTranslation()
  const canSubmit = code.length === OTP_LENGTH && !isSubmitting

  let resendLabel = t("Didn't receive a code? Resend")
  if (isResendActive) {
    resendLabel = t("Didn't receive a code? Resend ({{seconds}})", {
      seconds: secondsLeft,
    })
  } else if (isSending) {
    resendLabel = t('Sending...')
  }

  return (
    <AuthCard className='flex flex-col items-center gap-6 text-center'>
      <AuthBrand />
      <div className='space-y-2'>
        <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
          {t('Verify Your Email')}
        </h1>
        <p className='text-muted-foreground text-xs leading-5'>
          {t('Enter the 6-digit verification code sent to your email')}
        </p>
        <p className='text-foreground text-xs font-medium'>{email}</p>
      </div>
      <InputOTP
        maxLength={OTP_LENGTH}
        value={code}
        onChange={onCodeChange}
        inputMode='numeric'
        pattern='[0-9]*'
        containerClassName='justify-center gap-2'
      >
        <InputOTPGroup className='gap-2'>
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className='size-14 rounded-xl border text-lg'
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <AuthSubmitButton
        type='button'
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {isSubmitting ? <Loader2 className='size-4 animate-spin' /> : null}
        {t('Continue')}
      </AuthSubmitButton>
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground text-xs disabled:opacity-50'
        disabled={isSending || isResendActive}
        onClick={onResend}
      >
        {resendLabel}
      </button>
    </AuthCard>
  )
}
