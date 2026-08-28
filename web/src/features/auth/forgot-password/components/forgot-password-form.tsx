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
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
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
import {
  AuthFieldLabel,
  AuthTextField,
} from '@/features/auth/components/auth-text-field'
import { AuthTurnstileStep } from '@/features/auth/components/auth-turnstile-step'
import {
  forgotPasswordFormSchema,
  PASSWORD_RESET_COUNTDOWN,
} from '@/features/auth/constants'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useCountdown } from '@/hooks/use-countdown'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
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
        form.reset()
        startCountdown()
        toast.success(t('Reset email sent, please check your inbox'))
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

  if (view === 'turnstile' && showTurnstileSlot) {
    return (
      <AuthTurnstileStep
        siteKey={turnstileSiteKey}
        enabled={isTurnstileEnabled}
        onVerify={handleTurnstileVerify}
        onExpire={() => setTurnstileToken('')}
      />
    )
  }

  return (
    <AuthCard className='flex flex-col items-center gap-6'>
      <div className='flex w-full flex-col items-center gap-4 text-center'>
        <AuthBrand />
        <div className='space-y-2'>
          <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
            {t('Forgot password')}
          </h1>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Enter your registered email and we will send you a link to reset your password.'
            )}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn('flex w-full flex-col gap-4', className)}
          {...props}
        >
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem className='gap-2'>
                <AuthFieldLabel label={t('Email')} />
                <FormControl>
                  <AuthTextField
                    placeholder={t('Email')}
                    type='email'
                    autoComplete='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <AuthSubmitButton type='submit' disabled={isLoading || isActive}>
            {isLoading ? <Loader2 className='animate-spin' /> : null}
            {isActive
              ? t('Resend ({{seconds}}s)', { seconds: secondsLeft })
              : t('Send reset email')}
          </AuthSubmitButton>
        </form>
      </Form>

      <p className='text-muted-foreground w-full text-center text-xs'>
        {t("Don't have an account?")}{' '}
        <Link to='/sign-up' className='auth-link'>
          {t('Sign up')}
        </Link>
      </p>
    </AuthCard>
  )
}
