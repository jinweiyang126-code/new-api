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
import { useNavigate } from '@tanstack/react-router'
import { Building2, Loader2, User } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { register, wechatLoginByCode } from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { registerFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  getAffiliateCode,
  saveAffiliateCode,
} from '@/features/auth/lib/storage'
import { setSignupOrgIntent } from '@/features/auth/lib/signup-org-intent'
import { createSelfCustomer } from '@/features/customer-org/api'
import { useStatus } from '@/hooks/use-status'
import { isAuthBundle } from '@/lib/api'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { OrganizationSetupFields } from './organization-setup-fields'

const INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AccountType = 'personal' | 'organization'

type InviteEmailField = {
  key: string
  value: string
}

function createInviteField(value = ''): InviteEmailField {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value,
  }
}

type SignUpFormProps = React.HTMLAttributes<HTMLFormElement> & {
  setup?: 'organization'
  invite?: string
}

export function SignUpForm({
  className,
  setup,
  invite,
  ...props
}: SignUpFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const [accountType, setAccountType] = useState<AccountType>('personal')
  const [hasChosenAccountType, setHasChosenAccountType] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [organizationName, setOrganizationName] = useState('')
  const [inviteEmails, setInviteEmails] = useState([createInviteField()])
  const legalConsentErrorMessage = t('Please agree to the legal terms first')

  const { status } = useStatus()
  const {
    isTurnstileEnabled,
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
      confirmPassword: '',
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
  const turnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)
  const customerSelfRegisterEnabled = Boolean(
    status?.customer_self_register_enabled ??
      status?.data?.customer_self_register_enabled
  )
  const isInviteSignup = Boolean(invite?.trim())
  const isLoggedInOrgSetup = Boolean(
    user && setup === 'organization' && !user.customer_id
  )
  const showAccountTypeChooser =
    customerSelfRegisterEnabled && !isInviteSignup && !isLoggedInOrgSetup
  const isOrganizationFlow =
    isLoggedInOrgSetup ||
    (showAccountTypeChooser && accountType === 'organization')

  useEffect(() => {
    if (!showAccountTypeChooser) {
      setHasChosenAccountType(true)
    }
  }, [showAccountTypeChooser])

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
    if (isLoggedInOrgSetup) {
      setAccountType('organization')
      setHasChosenAccountType(true)
      setStep(2)
      setSignupOrgIntent(false)
      return
    }
    setSignupOrgIntent(isOrganizationFlow && step === 1)
  }, [isLoggedInOrgSetup, isOrganizationFlow, step])

  function collectInviteEmails(): string[] | null {
    const cleaned = inviteEmails
      .map((field) => field.value.trim())
      .filter(Boolean)
    for (const email of cleaned) {
      if (!INVITE_EMAIL_RE.test(email)) {
        toast.error(t('Invalid email'))
        return null
      }
    }
    return cleaned
  }

  async function submitExistingUserOrganization() {
    const name = organizationName.trim()
    if (!name) {
      toast.error(t('Please enter your organization name'))
      return
    }
    const emails = collectInviteEmails()
    if (!emails) return

    setIsLoading(true)
    try {
      const res = await createSelfCustomer({
        organization_name: name,
        invite_emails: emails,
      })
      if (!res?.success || !res.data?.customer_id) {
        toast.error(res?.message || t('Failed to create account'))
        return
      }
      if (user) {
        setUser({ ...user, customer_id: res.data.customer_id })
      }
      toast.success(t('Organization created'))
      void navigate({ to: '/dashboard', replace: true })
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
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
      if (!verificationCode) {
        toast.error(t('Please enter the verification code'))
        return
      }
    }

    if (isOrganizationFlow && step === 1) {
      setStep(2)
      return
    }

    if (isOrganizationFlow && step === 2) {
      const name = organizationName.trim()
      if (!name) {
        toast.error(t('Please enter your organization name'))
        return
      }
      if (!collectInviteEmails()) return
    }

    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const emails = isOrganizationFlow ? collectInviteEmails() : []
      if (isOrganizationFlow && emails === null) {
        setIsLoading(false)
        return
      }
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code: verificationCode || undefined,
        aff_code: getAffiliateCode(),
        turnstile: turnstileToken,
        ...(isOrganizationFlow
          ? {
              account_type: 'organization' as const,
              organization_name: organizationName.trim(),
              invite_emails: emails ?? [],
            }
          : {}),
      })

      if (res?.success) {
        setSignupOrgIntent(false)
        toast.success(t('Account created! Please sign in'))
        redirectToLogin()
      } else {
        toast.error(res?.message || t('Failed to create account'))
      }
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendVerificationCode() {
    if (await sendCode(emailValue || '')) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }
  }

  const handleOpenWeChatDialog = () => {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

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

  let verificationCodeAction: ReactNode = t('Send code')
  if (isActive) {
    verificationCodeAction = t('Resend ({{seconds}}s)', {
      seconds: secondsLeft,
    })
  } else if (isSendingCode) {
    verificationCodeAction = <Loader2 className='h-4 w-4 animate-spin' />
  }

  const submitLabel =
    isOrganizationFlow && step === 1 ? t('Next') : t('Create account')

  if (isLoggedInOrgSetup) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submitExistingUserOrganization()
        }}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <OrganizationSetupFields
          organizationName={organizationName}
          onOrganizationNameChange={setOrganizationName}
          inviteEmails={inviteEmails}
          onInviteEmailsChange={setInviteEmails}
          disabled={isLoading}
        />
        <div className='mt-2 flex gap-2'>
          <Button
            type='button'
            variant='outline'
            className='flex-1'
            disabled={isLoading}
            onClick={() => {
              setSignupOrgIntent(false)
              void navigate({ to: '/dashboard', replace: true })
            }}
          >
            {t('Back')}
          </Button>
          <Button
            type='submit'
            className='flex-1 justify-center gap-2'
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {t('Create account')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {showAccountTypeChooser && !hasChosenAccountType ? (
          <div className='grid gap-3'>
            <p className='text-muted-foreground text-sm'>
              {t('Choose the type of account you want to create')}
            </p>
            <Button
              type='button'
              variant='outline'
              className='h-auto w-full justify-start gap-3 rounded-lg px-4 py-4 text-left'
              onClick={() => {
                setAccountType('personal')
                setHasChosenAccountType(true)
                setStep(1)
              }}
            >
              <User className='text-muted-foreground h-5 w-5 shrink-0' />
              <span className='flex flex-col gap-0.5'>
                <span className='font-medium'>{t('Personal account')}</span>
                <span className='text-muted-foreground text-xs font-normal'>
                  {t('Use your personal wallet for API usage')}
                </span>
              </span>
            </Button>
            <Button
              type='button'
              variant='outline'
              className='h-auto w-full justify-start gap-3 rounded-lg px-4 py-4 text-left'
              onClick={() => {
                setAccountType('organization')
                setHasChosenAccountType(true)
                setStep(1)
              }}
            >
              <Building2 className='text-muted-foreground h-5 w-5 shrink-0' />
              <span className='flex flex-col gap-0.5'>
                <span className='font-medium'>{t('Organization account')}</span>
                <span className='text-muted-foreground text-xs font-normal'>
                  {t('Create an organization and invite teammates')}
                </span>
              </span>
            </Button>
          </div>
        ) : null}

        {(!showAccountTypeChooser || hasChosenAccountType) &&
        step === 1 &&
        showAccountTypeChooser ? (
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-left text-sm underline-offset-4 hover:underline'
            onClick={() => {
              setHasChosenAccountType(false)
              setStep(1)
            }}
          >
            {t('Change account type')}
          </button>
        ) : null}

        {(!showAccountTypeChooser || hasChosenAccountType) && (
          <>
        <div className={step === 1 ? 'grid gap-4' : 'hidden'}>
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Username')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter your username')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Password')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('Enter password (8-20 characters)')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Confirm password')}</FormLabel>
                <FormControl>
                  <PasswordInput placeholder={t('Confirm password')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {emailVerificationRequired && (
            <>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Email (required for verification)')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('name@example.com')}
                        type='email'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='flex items-end gap-2'>
                <div className='flex-1'>
                  <Input
                    placeholder={t('Verification code')}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </div>
                <Button
                  variant='outline'
                  type='button'
                  disabled={
                    isLoading ||
                    isSendingCode ||
                    isActive ||
                    !emailValue ||
                    !turnstileReady
                  }
                  onClick={handleSendVerificationCode}
                >
                  {verificationCodeAction}
                </Button>
              </div>
            </>
          )}

          {isTurnstileEnabled && (
            <div className='mt-2'>
              <Turnstile
                key={turnstileWidgetKey}
                siteKey={turnstileSiteKey}
                onVerify={setTurnstileToken}
              />
            </div>
          )}

          <LegalConsent
            status={status}
            checked={agreedToLegal}
            onCheckedChange={setAgreedToLegal}
            className='mt-1'
          />
        </div>

        {step === 2 ? (
          <OrganizationSetupFields
            organizationName={organizationName}
            onOrganizationNameChange={setOrganizationName}
            inviteEmails={inviteEmails}
            onInviteEmailsChange={setInviteEmails}
            disabled={isLoading}
          />
        ) : null}

        {step === 2 ? (
          <div className='mt-2 flex gap-2'>
            <Button
              type='button'
              variant='outline'
              className='flex-1'
              disabled={isLoading}
              onClick={() => setStep(1)}
            >
              {t('Back')}
            </Button>
            <Button
              type='submit'
              className='flex-1 justify-center gap-2'
              disabled={isLoading || !turnstileReady}
            >
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              {t('Create account')}
            </Button>
          </div>
        ) : (
          <Button
            type='submit'
            className='mt-2 w-full justify-center gap-2'
            disabled={
              isLoading ||
              (requiresLegalConsent && !agreedToLegal) ||
              (!isOrganizationFlow && !turnstileReady)
            }
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {submitLabel}
          </Button>
        )}

        {oauthRegisterEnabled && step === 1 && (
          <OAuthProviders
            status={status}
            disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
            onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
            isWeChatLoading={isWeChatSubmitting}
            className='pt-2'
          />
        )}
          </>
        )}
      </form>

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
          )}
          contentClassName='max-w-sm'
          headerClassName='text-left'
          contentHeight='auto'
          bodyClassName='space-y-4'
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={
                  isWeChatSubmitting ||
                  !wechatCode.trim() ||
                  (requiresLegalConsent && !agreedToLegal)
                }
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
