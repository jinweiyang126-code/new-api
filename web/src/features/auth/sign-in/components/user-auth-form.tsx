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
import axios from 'axios'
import { KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { login, wechatLoginByCode } from '@/features/auth/api'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthCard } from '@/features/auth/components/auth-card'
import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button'
import {
  AuthPasswordField,
  AuthFieldLabel,
  AuthTextField,
} from '@/features/auth/components/auth-text-field'
import { AuthTurnstileStep } from '@/features/auth/components/auth-turnstile-step'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { WeChatLoginDialog } from '@/features/auth/components/wechat-login-dialog'
import { loginFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import type { AuthFormProps } from '@/features/auth/types'
import { useStatus } from '@/hooks/use-status'
import { isAuthBundle } from '@/lib/api'
import {
  buildAssertionResult,
  prepareCredentialRequestOptions,
  isPasskeySupported as detectPasskeySupport,
} from '@/lib/passkey'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: AuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [view, setView] = useState<'form' | 'turnstile'>('form')
  const [pendingSubmit, setPendingSubmit] = useState<z.infer<
    typeof loginFormSchema
  > | null>(null)
  const loginFailedMessage = t('Login failed')

  const { status } = useStatus()
  const passkeyLoginEnabled = Boolean(
    status?.passkey_login ?? status?.data?.passkey_login
  )
  const passwordLoginEnabled =
    (status?.password_login_enabled ??
      status?.data?.password_login_enabled ??
      true) !== false
  const {
    isTurnstileEnabled,
    showTurnstileSlot,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginSuccess, redirectTo2FA } = useAuthRedirect()
  const setPending2FAFlowToken = useAuthStore(
    (state) => state.auth.setPending2FAFlowToken
  )

  const passkeyButtonDisabled = isPasskeyLoading || !passkeySupported
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const showSignUpLink =
    !status?.self_use_mode_enabled && status?.register_enabled !== false

  useEffect(() => {
    detectPasskeySupport()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

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

  async function submitLogin(
    data: z.infer<typeof loginFormSchema>,
    tokenOverride?: string
  ) {
    setIsLoading(true)
    try {
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: tokenOverride ?? turnstileToken,
      })

      if (res.success) {
        if (res.data && 'require_2fa' in res.data && res.data.require_2fa) {
          if (!res.data.flow_token) {
            throw new Error(t('Login flow expired. Please sign in again.'))
          }
          setPending2FAFlowToken(res.data.flow_token)
          redirectTo2FA()
          return
        }

        if (!isAuthBundle(res.data)) {
          throw new Error(t('Login failed'))
        }
        await handleLoginSuccess(res.data, redirectTo)
        toast.success(t('Welcome back!'))
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return
      toast.error(error instanceof Error ? error.message : loginFailedMessage)
    } finally {
      setIsLoading(false)
      setPendingSubmit(null)
      setTurnstileToken('')
    }
  }

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    if (showTurnstileSlot && !turnstileToken) {
      setPendingSubmit(data)
      setView('turnstile')
      return
    }

    if (!validateTurnstile()) return
    await submitLogin(data)
  }

  function handleTurnstileVerify(token: string) {
    setTurnstileToken(token)
    if (pendingSubmit) {
      void submitLogin(pendingSubmit, token)
      setView('form')
    }
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
        await handleLoginSuccess(res.data, redirectTo)
        toast.success(t('Signed in via WeChat'))
        handleWeChatDialogChange(false)
      } else {
        if (getServerErrorMessageKey(res)) return
        toast.error(res?.message || loginFailedMessage)
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      toast.error(loginFailedMessage)
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  async function handlePasskeyLogin() {
    if (!passkeySupported) {
      toast.error(t('Passkey is not supported on this device'))
      return
    }

    if (!navigator?.credentials) {
      toast.error(t('Passkey is not available in this browser'))
      return
    }

    setIsPasskeyLoading(true)
    try {
      const begin = await beginPasskeyLogin()
      if (!begin.success) {
        if (getServerErrorMessageKey(begin)) return
        throw new Error(begin.message || t('Failed to start Passkey login'))
      }

      const publicKey = prepareCredentialRequestOptions(
        begin.data?.options ?? begin.data
      )
      const flowToken = begin.data?.flow_token
      if (!flowToken) {
        throw new Error(t('Login flow expired. Please sign in again.'))
      }

      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null

      if (!credential) {
        toast.info(t('Passkey login was cancelled'))
        return
      }

      const assertion = buildAssertionResult(credential)
      if (!assertion) {
        throw new Error(t('Invalid Passkey response'))
      }

      const finish = await finishPasskeyLogin(flowToken, assertion)
      if (!finish.success) {
        if (getServerErrorMessageKey(finish)) return
        throw new Error(finish.message || t('Failed to complete Passkey login'))
      }

      if (!isAuthBundle(finish.data)) {
        throw new Error(t('Missing user data from Passkey login response'))
      }

      await handleLoginSuccess(finish.data, redirectTo)
      toast.success(t('Signed in with Passkey'))
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(t('Passkey login was cancelled or timed out'))
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error(t('Passkey login failed'))
      }
    } finally {
      setIsPasskeyLoading(false)
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
          'flex flex-col items-center gap-6',
          view === 'turnstile' && 'hidden'
        )}
      >
      <div className='flex w-full flex-col items-center gap-6'>
        <div className='flex w-full flex-col items-center gap-4'>
          <AuthBrand />
          <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
            {t('Sign In')}
          </h1>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn('flex w-full flex-col gap-4', className)}
            {...props}
          >
            <OAuthProviders
              status={status}
              redirectTo={redirectTo}
              layout='icons'
              disabled={isLoading}
              onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
              isWeChatLoading={isWeChatSubmitting}
            />

            {passwordLoginEnabled && (
              <>
                <FormField
                  control={form.control}
                  name='username'
                  render={({ field }) => (
                    <FormItem className='gap-2'>
                      <AuthFieldLabel label={t('User name/Email')} />
                      <FormControl>
                        <AuthTextField
                          placeholder={t('Enter your user name/Email')}
                          autoComplete='username'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem className='gap-2'>
                      <AuthFieldLabel
                        label={t('Password')}
                        extra={
                          <Link
                            to='/forgot-password'
                            className='auth-link text-xs'
                          >
                            {t('Forgot password?')}
                          </Link>
                        }
                      />
                      <FormControl>
                        <AuthPasswordField
                          placeholder={t('Enter password')}
                          autoComplete='current-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AuthSubmitButton
                  type='submit'
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className='animate-spin' /> : null}
                  {t('Continue')}
                </AuthSubmitButton>
              </>
            )}

            {passkeyLoginEnabled && (
              <div className='space-y-1'>
                <AuthSubmitButton
                  type='button'
                  variant='outline'
                  disabled={passkeyButtonDisabled}
                  onClick={handlePasskeyLogin}
                  className='bg-transparent'
                >
                  {isPasskeyLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <KeyRound className='h-4 w-4' />
                  )}
                  {t('Sign in with Passkey')}
                </AuthSubmitButton>
                {!passkeySupported && (
                  <p className='text-muted-foreground text-center text-xs'>
                    {t('Passkey is not supported on this device.')}
                  </p>
                )}
              </div>
            )}
          </form>
        </Form>
      </div>

      {showSignUpLink && (
        <p className='text-muted-foreground w-full text-center text-xs'>
          {t("Don't have an account?")}{' '}
          <Link to='/sign-up' className='auth-link'>
            {t('Sign up')}
          </Link>
        </p>
      )}

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
    </>
  )
}
