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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { login, register, wechatLoginByCode, checkEmailAvailable } from '@/features/auth/api'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthCard } from '@/features/auth/components/auth-card'
import { AuthEmailVerifyStep } from '@/features/auth/components/auth-email-verify-step'
import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button'
import {
  AuthPasswordField,
  AuthFieldLabel,
  AuthTextField,
} from '@/features/auth/components/auth-text-field'
import { AuthTurnstileStep } from '@/features/auth/components/auth-turnstile-step'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { WeChatLoginDialog } from '@/features/auth/components/wechat-login-dialog'
import { registerFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useAuthChrome } from '@/features/auth/lib/auth-chrome-context'
import { setSignupOnboardingPending } from '@/features/auth/lib/signup-onboarding'
import {
  getAffiliateCode,
  saveAffiliateCode,
} from '@/features/auth/lib/storage'
import { useStatus } from '@/hooks/use-status'
import { isAuthBundle } from '@/lib/api'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

type SignUpFormProps = React.HTMLAttributes<HTMLFormElement> & {
  invite?: string
}

const TURNSTILE_REFRESH_TIMEOUT_MS = 15_000

export function SignUpForm({ className, invite, ...props }: SignUpFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const [view, setView] = useState<'form' | 'turnstile' | 'verify'>('form')
  const [pendingAction, setPendingAction] = useState<
    'register' | 'send-code' | null
  >(null)
  const turnstileVerifyRef = useRef<((token: string) => void) | null>(null)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')

  const { status } = useStatus()
  const { setAction: setAuthChromeAction } = useAuthChrome()
  const {
    isTurnstileEnabled,
    showTurnstileSlot,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { redirectToLogin, handleLoginSuccess } = useAuthRedirect()
  const {
    isSending: isSendingCode,
    secondsLeft,
    isActive,
    sendCode,
  } = useEmailVerification({
    turnstileToken,
    validateTurnstile,
  })

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  })

  const emailValue = form.watch('email')
  const emailVerificationRequired = !!status?.email_verification
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const oauthRegisterEnabled =
    status?.oauth_register_enabled ??
    status?.data?.oauth_register_enabled ??
    true
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const customerSelfRegisterEnabled = Boolean(
    status?.customer_self_register_enabled ??
      status?.data?.customer_self_register_enabled
  )
  const isInviteSignup = Boolean(invite?.trim())
  const shouldOnboardAfterSignup =
    customerSelfRegisterEnabled && !isInviteSignup

  const goBackToForm = useCallback(() => {
    setView('form')
    setPendingAction(null)
  }, [])

  useEffect(() => {
    if (view === 'verify') {
      setAuthChromeAction({
        label: t('Back'),
        onClick: goBackToForm,
      })
      return () => setAuthChromeAction(null)
    }
    setAuthChromeAction(null)
    return () => setAuthChromeAction(null)
  }, [view, setAuthChromeAction, t, goBackToForm])

  async function ensureEmailAvailable(email: string) {
    const trimmed = email.trim()
    if (!trimmed) return true
    try {
      const res = await checkEmailAvailable(trimmed)
      if (res?.success && res.data?.available === false) {
        form.setError('email', {
          type: 'manual',
          message: t('Email address is already in use'),
        })
        return false
      }
      if (res?.success) {
        form.clearErrors('email')
      }
      return true
    } catch {
      // Network errors should not block signup; register/send-code still validates.
      return true
    }
  }

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
  }, [])

  useEffect(() => {
    setSignupOnboardingPending(shouldOnboardAfterSignup)
  }, [shouldOnboardAfterSignup])

  const handleTurnstileVerify = useCallback(
    (token: string) => {
      setTurnstileToken(token)
      turnstileVerifyRef.current?.(token)
    },
    [setTurnstileToken]
  )

  const refreshTurnstileTokenForLogin = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        turnstileVerifyRef.current = null
        reject(new Error('Turnstile refresh timed out'))
      }, TURNSTILE_REFRESH_TIMEOUT_MS)

      turnstileVerifyRef.current = (token: string) => {
        if (!token) return
        window.clearTimeout(timeoutId)
        turnstileVerifyRef.current = null
        resolve(token)
      }

      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    })
  }, [setTurnstileToken])

  async function performRegister(
    data: z.infer<typeof registerFormSchema>,
    code: string,
    tokenOverride?: string
  ) {
    setIsLoading(true)
    try {
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code: code || undefined,
        aff_code: getAffiliateCode(),
        turnstile: tokenOverride ?? turnstileToken,
      })

      if (!res?.success) {
        toast.error(
          t(res?.message || 'Failed to create account')
        )
        return
      }

      let loginTurnstileToken = turnstileToken
      if (isTurnstileEnabled) {
        try {
          loginTurnstileToken = await refreshTurnstileTokenForLogin()
        } catch {
          toast.success(t('Account created! Please sign in'))
          redirectToLogin()
          return
        }
      }

      const loginRes = await login({
        username: data.username,
        password: data.password,
        turnstile: loginTurnstileToken,
      })

      if (
        loginRes.success &&
        loginRes.data &&
        isAuthBundle(loginRes.data)
      ) {
        await handleLoginSuccess(loginRes.data)
        toast.success(t('Account created!'))
        return
      }

      if (loginRes.success && loginRes.data && 'require_2fa' in loginRes.data) {
        toast.success(t('Account created! Please sign in'))
        redirectToLogin()
        return
      }

      toast.success(t('Account created! Please sign in'))
      redirectToLogin()
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
      setPendingAction(null)
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }
  }

  async function requestVerificationCode(email: string, tokenOverride?: string) {
    const sent = await sendCode(email, tokenOverride)
    setTurnstileToken('')
    setTurnstileWidgetKey((current) => current + 1)
    if (sent) {
      setView('verify')
      return true
    }
    return false
  }

  async function onSubmit(data: z.infer<typeof registerFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (emailVerificationRequired) {
      if (!data.email) {
        toast.error(t('Please enter your email'))
        return
      }
      if (!(await ensureEmailAvailable(data.email))) {
        return
      }
      if (!verificationCode) {
        if (showTurnstileSlot && !turnstileToken) {
          setPendingAction('send-code')
          setView('turnstile')
          return
        }
        await requestVerificationCode(data.email)
        return
      }
    }

    if (showTurnstileSlot && !turnstileToken) {
      setPendingAction('register')
      setView('turnstile')
      return
    }

    if (!validateTurnstile()) return
    await performRegister(data, verificationCode)
  }

  async function handleVerifiedTurnstile(token: string) {
    handleTurnstileVerify(token)
    const data = form.getValues()
    if (pendingAction === 'send-code') {
      setPendingAction(null)
      if (data.email) {
        await requestVerificationCode(data.email, token)
      }
      return
    }
    if (pendingAction === 'register') {
      setPendingAction(null)
      await performRegister(data, verificationCode, token)
      setView(emailVerificationRequired ? 'verify' : 'form')
    }
  }

  function submitEmailVerification(code: string) {
    const trimmed = code.trim()
    if (!trimmed) {
      toast.error(t('Please enter the verification code'))
      return
    }
    setVerificationCode(trimmed)
    if (showTurnstileSlot && !turnstileToken) {
      setPendingAction('register')
      setView('turnstile')
      return
    }
    if (!validateTurnstile()) return
    void performRegister(form.getValues(), trimmed)
  }

  function resendVerificationCode() {
    if (!emailValue) return
    if (showTurnstileSlot && !turnstileToken) {
      setPendingAction('send-code')
      setView('turnstile')
      return
    }
    void requestVerificationCode(emailValue)
  }

  const handleOpenWeChatDialog = () => {
    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success && isAuthBundle(res.data)) {
        await handleLoginSuccess(res.data)
        toast.success(t('Signed in via WeChat'))
        handleWeChatDialogChange(false)
      } else {
        if (getServerErrorMessageKey(res)) return
        toast.error(res?.message || t('Login failed'))
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      toast.error(t('Login failed'))
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  return (
    <>
      {showTurnstileSlot ? (
        <AuthTurnstileStep
          key={turnstileWidgetKey}
          siteKey={turnstileSiteKey}
          enabled={isTurnstileEnabled}
          visible={view === 'turnstile'}
          onVerify={handleVerifiedTurnstile}
          onExpire={() => setTurnstileToken('')}
        />
      ) : null}

      {view === 'verify' && emailVerificationRequired ? (
        <AuthEmailVerifyStep
          email={emailValue || ''}
          code={verificationCode}
          onCodeChange={setVerificationCode}
          onSubmit={submitEmailVerification}
          onResend={resendVerificationCode}
          onEditEmail={goBackToForm}
          isSubmitting={isLoading}
          isSending={isSendingCode}
          secondsLeft={secondsLeft}
          isResendActive={isActive}
        />
      ) : (
        <AuthCard
          className={cn(
            'flex flex-col items-center gap-6',
            view === 'turnstile' && 'hidden'
          )}
        >
      <div className='flex w-full flex-col items-center gap-6'>
        <div className='flex w-full flex-col items-center gap-4'>
          <AuthBrand />
          <div className='flex flex-col items-center gap-2 text-center'>
            <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
              {t('Sign Up Account')}
            </h1>
            <p className='text-muted-foreground text-xs'>
              {t('Please enter your information to create account')}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn('flex w-full flex-col gap-4', className)}
            {...props}
          >
            {oauthRegisterEnabled && (
              <OAuthProviders
                status={status}
                layout='icons'
                disabled={isLoading}
                onWeChatLogin={
                  hasWeChatLogin ? handleOpenWeChatDialog : undefined
                }
                isWeChatLoading={isWeChatSubmitting}
              />
            )}

            <FormField
              control={form.control}
              name='username'
              render={({ field }) => (
                <FormItem className='gap-2'>
                  <AuthFieldLabel label={t('User name')} />
                  <FormControl>
                    <AuthTextField
                      placeholder={t('Enter your user name')}
                      autoComplete='username'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {emailVerificationRequired && (
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='gap-2'>
                    <AuthFieldLabel label={t('Email')} />
                    <FormControl>
                      <AuthTextField
                        placeholder={t('Enter your email address')}
                        type='email'
                        autoComplete='email'
                        {...field}
                        onBlur={async (event) => {
                          field.onBlur()
                          const value = event.target.value
                          if (value?.trim()) {
                            await ensureEmailAvailable(value)
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem className='gap-2'>
                  <AuthFieldLabel label={t('Password')} />
                  <FormControl>
                    <AuthPasswordField
                      placeholder={t('Create a password')}
                      autoComplete='new-password'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LegalConsent
              status={status}
              checked={agreedToLegal}
              onCheckedChange={setAgreedToLegal}
            />

            <AuthSubmitButton
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              {t('Continue')}
            </AuthSubmitButton>
          </form>
        </Form>
      </div>

      <p className='text-muted-foreground w-full text-center text-xs'>
        {t('Already have an account?')}{' '}
        <Link to='/sign-in' className='auth-link'>
          {t('Log in')}
        </Link>
      </p>

      {hasWeChatLogin && (
        <WeChatLoginDialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          qrCodeUrl={wechatQrCodeUrl}
          code={wechatCode}
          onCodeChange={setWeChatCode}
          onConfirm={handleWeChatLogin}
          submitting={isWeChatSubmitting}
        />
      )}
    </AuthCard>
      )}
    </>
  )
}
