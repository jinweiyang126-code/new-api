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
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { sendPasswordResetEmail } from '@/features/auth/api'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthCard } from '@/features/auth/components/auth-card'
import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button'
import { AuthTextField } from '@/features/auth/components/auth-text-field'
import { AuthTurnstileStep } from '@/features/auth/components/auth-turnstile-step'
import {
  forgotPasswordFormSchema,
  PASSWORD_RESET_COUNTDOWN,
} from '@/features/auth/constants'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useCountdown } from '@/hooks/use-countdown'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const brandName = systemName || DEFAULT_SYSTEM_NAME
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [view, setView] = useState<'form' | 'turnstile'>('form')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const {
    isTurnstileEnabled,
    showTurnstileSlot,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: PASSWORD_RESET_COUNTDOWN })

  const form = useForm<z.infer<typeof forgotPasswordFormSchema>>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: '' },
  })

  async function sendReset(email: string, tokenOverride?: string) {
    setIsLoading(true)
    try {
      const res = await sendPasswordResetEmail(
        email,
        tokenOverride ?? turnstileToken
      )
      if (res?.success) {
        form.setValue('email', email)
        setSent(true)
        startCountdown()
      } else {
        toast.error(res?.message || t('Failed to send reset email'))
      }
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
      setPendingEmail(null)
      setTurnstileToken('')
      setView('form')
    }
  }

  async function onSubmit(data: z.infer<typeof forgotPasswordFormSchema>) {
    if (showTurnstileSlot && !turnstileToken) {
      setPendingEmail(data.email)
      setView('turnstile')
      return
    }

    if (!validateTurnstile()) return
    await sendReset(data.email)
  }

  function handleTurnstileVerify(token: string) {
    setTurnstileToken(token)
    if (pendingEmail) {
      void sendReset(pendingEmail, token)
    }
  }

  return (
    <>
      {showTurnstileSlot ? (
        <AuthTurnstileStep
          siteKey={turnstileSiteKey}
          enabled={isTurnstileEnabled}
          visible={view === 'turnstile'}
          onVerify={handleTurnstileVerify}
          onExpire={() => setTurnstileToken('')}
        />
      ) : null}

      <AuthCard
        className={cn(
          'flex w-full max-w-[360px] flex-col items-center gap-10',
          view === 'turnstile' && 'hidden'
        )}
      >
        <div className='flex w-full flex-col items-center gap-6'>
          <div className='flex w-full flex-col items-center gap-4 text-center'>
            <AuthBrand />
            <div className='flex flex-col items-center gap-2'>
              <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
                {t('Forgot Password')}
              </h1>
              <p className='text-muted-foreground max-w-[385px] text-xs leading-[1.5]'>
                {t(
                  'Please enter the email you used to register with {{systemName}} to request a password reset',
                  { systemName: brandName }
                )}
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className={cn(
                'flex w-full flex-col gap-10',
                className
              )}
              {...props}
            >
              <div className='flex w-full flex-col gap-6'>
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem className='gap-2'>
                      <FormControl>
                        <AuthTextField
                          placeholder={t('Enter your email address')}
                          type='text'
                          inputMode='email'
                          autoComplete='email'
                          autoCapitalize='none'
                          autoCorrect='off'
                          spellCheck={false}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {sent ? (
                  <div className='flex w-full gap-2 rounded-[12px] border border-[rgba(0,187,126,0.5)] bg-[rgba(0,187,126,0.1)] p-4 text-left'>
                    <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-[#00BB7E]' />
                    <div className='flex min-w-0 flex-col gap-2'>
                      <p className='text-sm font-medium leading-none'>
                        {t('Reset link has been sent')}
                      </p>
                      <p className='text-xs leading-normal text-foreground/90'>
                        {t(
                          'Please check your inbox and click the link in the email to reset your password'
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <AuthSubmitButton
                type='submit'
                className='font-semibold'
                disabled={isLoading || isActive}
              >
                {isLoading ? <Loader2 className='animate-spin' /> : null}
                {isActive
                  ? t('Resend ({{seconds}}s)', { seconds: secondsLeft })
                  : t('Send reset link')}
              </AuthSubmitButton>
            </form>
          </Form>
        </div>
      </AuthCard>
    </>
  )
}
