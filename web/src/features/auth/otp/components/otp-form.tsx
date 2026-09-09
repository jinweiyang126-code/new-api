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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button'
import {
  AuthTextField,
} from '@/features/auth/components/auth-text-field'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { login2fa } from '@/features/auth/api'
import {
  otpFormSchema,
  OTP_LENGTH,
  BACKUP_CODE_LENGTH,
} from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import {
  isValidOTP,
  isValidBackupCode,
  formatBackupCode,
  cleanBackupCode,
} from '@/features/auth/lib/validation'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type OtpFormProps = {
  useBackupCode: boolean
  onToggleMode: () => void
  className?: string
}

export function OtpForm({
  useBackupCode,
  onToggleMode,
  className,
}: OtpFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const autoSubmittedForRef = useRef<string | null>(null)

  const pending2FAFlowToken = useAuthStore(
    (state) => state.auth.pending2FAFlowToken
  )
  const { handleLoginSuccess, redirectToLogin } = useAuthRedirect()

  const form = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function verify(codeRaw: string) {
    if (useBackupCode) {
      if (!isValidBackupCode(codeRaw)) {
        toast.error(t('Backup code must be in format XXXX-XXXX'))
        return
      }
    } else if (!isValidOTP(codeRaw)) {
      toast.error(t('Verification code must be 6 digits'))
      return
    }

    setIsLoading(true)
    try {
      const code = useBackupCode ? cleanBackupCode(codeRaw) : codeRaw
      if (!pending2FAFlowToken) {
        toast.error(t('Login flow expired. Please sign in again.'))
        redirectToLogin()
        return
      }
      const res = await login2fa({
        code,
        flow_token: pending2FAFlowToken,
      })

      if (!res.success) {
        if (getServerErrorMessageKey(res)) return
        toast.error(res.message || t('Invalid code'))
        autoSubmittedForRef.current = null
        return
      }

      if (!res.data) {
        throw new Error(t('Login failed'))
      }

      await handleLoginSuccess(res.data)
      toast.success(t('Signed in'))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('2FA verification error:', error)
      autoSubmittedForRef.current = null
      if (getServerErrorMessageKey(error)) return
      const errorMessage =
        error instanceof Error ? error.message : t('Verification failed')
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  async function onSubmit(data: z.infer<typeof otpFormSchema>) {
    await verify(data.otp)
  }

  function handleOtpChange(value: string) {
    form.setValue('otp', value, { shouldValidate: true })
    if (useBackupCode) return
    if (value.length < OTP_LENGTH) {
      autoSubmittedForRef.current = null
      return
    }
    if (isLoading || autoSubmittedForRef.current === value) return
    autoSubmittedForRef.current = value
    void verify(value)
  }

  function handleToggleMode() {
    autoSubmittedForRef.current = null
    form.setValue('otp', '')
    onToggleMode()
  }

  const isBackupValid = otp.length >= BACKUP_CODE_LENGTH
  const otpSlotClassName =
    'size-14 rounded-[12px] border border-[#E5E5E7] bg-white text-lg shadow-none data-[active=true]:border-primary data-[active=true]:ring-0 data-[active=true]:ring-offset-0 dark:border-[#2E2E2E] dark:bg-[#212121] dark:data-[active=true]:border-[#A3A3A3]'

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('flex w-full flex-col items-center gap-6', className)}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormControl>
                {useBackupCode ? (
                  <AuthTextField
                    placeholder={t('Enter backup code (e.g., CAWD-OQDV)')}
                    value={field.value}
                    maxLength={BACKUP_CODE_LENGTH}
                    autoComplete='off'
                    className='font-mono uppercase'
                    disabled={isLoading}
                    onChange={(e) => {
                      const formatted = formatBackupCode(e.target.value)
                      field.onChange(formatted)
                    }}
                  />
                ) : (
                  <div className='relative flex flex-col items-center gap-3'>
                    <InputOTP
                      maxLength={OTP_LENGTH}
                      value={field.value}
                      onChange={handleOtpChange}
                      inputMode='numeric'
                      pattern='[0-9]*'
                      containerClassName='justify-center gap-2'
                      disabled={isLoading}
                    >
                      <InputOTPGroup className='gap-2'>
                        {Array.from({ length: OTP_LENGTH }, (_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className={otpSlotClassName}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    {isLoading ? (
                      <p className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
                        <Loader2 className='size-3.5 animate-spin' />
                        {t('Submitting...')}
                      </p>
                    ) : null}
                  </div>
                )}
              </FormControl>
              <FormMessage className='text-center' />
            </FormItem>
          )}
        />

        {useBackupCode ? (
          <AuthSubmitButton
            type='submit'
            disabled={!isBackupValid || isLoading}
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {t('Verify and Sign In')}
          </AuthSubmitButton>
        ) : null}

        <button
          type='button'
          className='auth-link text-xs'
          disabled={isLoading}
          onClick={handleToggleMode}
        >
          {useBackupCode ? t('Use authenticator code') : t('Use backup code')}
        </button>
      </form>
    </Form>
  )
}
