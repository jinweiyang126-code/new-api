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
import { Loader2, Pencil } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { OTP_LENGTH } from '@/features/auth/constants'

import { AuthBrand } from './auth-brand'
import { AuthCard } from './auth-card'

type AuthEmailVerifyStepProps = {
  email: string
  code: string
  onCodeChange: (value: string) => void
  onSubmit: (code: string) => void
  onResend: () => void
  onEditEmail?: () => void
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
  onEditEmail,
  isSubmitting,
  isSending,
  secondsLeft,
  isResendActive,
}: AuthEmailVerifyStepProps) {
  const { t } = useTranslation()
  const autoSubmittedForRef = useRef<string | null>(null)

  let resendLabel = t("Didn't receive a code? Resend")
  if (isSending) {
    resendLabel = t('Sending...')
  } else if (isResendActive) {
    // Concatenate seconds so countdown always renders (avoids i18n interpolation misses)
    resendLabel = `${t("Didn't receive a code? Resend")} (${secondsLeft}s)`
  }

  function handleCodeChange(value: string) {
    onCodeChange(value)
    if (value.length < OTP_LENGTH) {
      autoSubmittedForRef.current = null
      return
    }
    if (isSubmitting || autoSubmittedForRef.current === value) return
    autoSubmittedForRef.current = value
    onSubmit(value)
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
        <p className='text-foreground inline-flex items-center justify-center gap-1.5 text-xs font-medium'>
          <span>{email}</span>
          {onEditEmail ? (
            <button
              type='button'
              onClick={onEditEmail}
              className='text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-md'
              aria-label={t('Edit email')}
              title={t('Edit email')}
            >
              <Pencil className='size-3.5' />
            </button>
          ) : null}
        </p>
      </div>
      <div className='relative flex flex-col items-center gap-3'>
        <InputOTP
          maxLength={OTP_LENGTH}
          value={code}
          onChange={handleCodeChange}
          inputMode='numeric'
          pattern='[0-9]*'
          containerClassName='justify-center gap-2'
          disabled={isSubmitting}
        >
          <InputOTPGroup className='gap-2'>
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className='size-14 rounded-[12px] border border-border text-lg data-[active=true]:border-[#A3A3A3] data-[active=true]:ring-0 data-[active=true]:ring-offset-0 dark:border-[#2E2E2E]'
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {isSubmitting ? (
          <p className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
            <Loader2 className='size-3.5 animate-spin' />
            {t('Submitting...')}
          </p>
        ) : null}
      </div>
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground text-xs disabled:opacity-50'
        disabled={isSending || isResendActive || isSubmitting}
        onClick={onResend}
      >
        {resendLabel}
      </button>
    </AuthCard>
  )
}
