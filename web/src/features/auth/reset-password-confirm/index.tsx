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
import { useNavigate } from '@tanstack/react-router'
import { CheckIcon, CopyIcon, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCountdown } from '@/hooks/use-countdown'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'

import { AuthLayout } from '../auth-layout'
import { AuthBrand } from '../components/auth-brand'
import { AuthCard } from '../components/auth-card'
import { AuthSubmitButton } from '../components/auth-submit-button'
import {
  AuthFieldLabel,
  AuthTextField,
} from '../components/auth-text-field'
import { useAuthChrome } from '../lib/auth-chrome-context'

export type ResetPasswordSearchParams = {
  email?: string
  token?: string
}

type ResetPasswordConfirmProps = ResetPasswordSearchParams

export function ResetPasswordConfirm({
  email,
  token,
}: ResetPasswordConfirmProps) {
  return (
    <AuthLayout>
      <ResetPasswordConfirmContent email={email} token={token} />
    </AuthLayout>
  )
}

function ResetPasswordConfirmContent({
  email,
  token,
}: ResetPasswordConfirmProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAction: setAuthChromeAction } = useAuthChrome()
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoStartedRef = useRef(false)
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: 30 })

  const isValidResetLink = Boolean(email && token)

  const goSignIn = useCallback(() => {
    void navigate({ to: '/sign-in', replace: true })
  }, [navigate])

  useEffect(() => {
    setAuthChromeAction({
      label: t('Log in'),
      onClick: goSignIn,
    })
    return () => setAuthChromeAction(null)
  }, [setAuthChromeAction, t, goSignIn])

  const resetPassword = useCallback(async () => {
    if (!isValidResetLink || !email || !token) {
      setError(t('Invalid reset link, please request a new password reset.'))
      return
    }

    startCountdown()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/user/reset', { email, token }, {
        skipBusinessError: true,
      } as Record<string, unknown>)

      if (res?.data?.success) {
        const password = String(res.data.data ?? '')
        setNewPassword(password)
        const copySuccess = await copyToClipboard(password)
        if (copySuccess) {
          toast.success(t('Password has been copied to clipboard'))
        }
      } else {
        setError(
          res?.data?.message ||
            t('Invalid reset link, please request a new password reset.')
        )
      }
    } catch {
      setError(t('Invalid reset link, please request a new password reset.'))
    } finally {
      setLoading(false)
    }
  }, [email, token, isValidResetLink, startCountdown, t])

  useEffect(() => {
    if (!isValidResetLink || autoStartedRef.current) return
    autoStartedRef.current = true
    void resetPassword()
  }, [isValidResetLink, resetPassword])

  async function handleCopy() {
    if (!newPassword) return
    const copySuccess = await copyToClipboard(newPassword)
    if (copySuccess) {
      setCopied(true)
      toast.success(t('Password has been copied to clipboard'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <AuthCard className='flex w-full max-w-[360px] flex-col items-center gap-10'>
      <div className='flex w-full flex-col items-center gap-6'>
        <div className='flex w-full flex-col items-center gap-4 text-center'>
          <AuthBrand />
          <div className='flex flex-col items-center gap-2'>
            <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
              {t('Reset Password')}
            </h1>
            <p className='text-muted-foreground max-w-[385px] text-xs leading-[1.5]'>
              {(() => {
                if (newPassword) {
                  return t('Your password has been reset successfully')
                }
                if (loading) {
                  return t('Resetting your password...')
                }
                return t('auth.resetPasswordConfirm.description')
              })()}
            </p>
          </div>
        </div>

        {!isValidResetLink || error ? (
          <Alert variant='destructive' className='w-full text-left'>
            <AlertDescription>
              {error ||
                t('Invalid reset link, please request a new password reset.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {loading && !newPassword ? (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Loader2 className='size-4 animate-spin' />
            {t('Resetting your password...')}
          </div>
        ) : null}

        {newPassword ? (
          <div className='flex w-full flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <AuthFieldLabel label={t('Email')} />
              <AuthTextField value={email || ''} disabled readOnly />
            </div>
            <div className='flex flex-col gap-2'>
              <AuthFieldLabel label={t('New password')} />
              <div className='relative'>
                <AuthTextField
                  value={newPassword}
                  disabled
                  readOnly
                  className='pe-11 font-mono'
                />
                <button
                  type='button'
                  onClick={() => void handleCopy()}
                  className='text-muted-foreground hover:text-foreground absolute end-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center'
                  aria-label={t('Copy')}
                >
                  {copied ? (
                    <CheckIcon className='size-4' />
                  ) : (
                    <CopyIcon className='size-4' />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <AuthSubmitButton
        type='button'
        className={cn('font-semibold', !newPassword && !error && 'hidden')}
        onClick={() => {
          if (newPassword || error) {
            goSignIn()
            return
          }
          void resetPassword()
        }}
        disabled={
          newPassword || error
            ? false
            : loading || isActive || !isValidResetLink
        }
      >
        {(() => {
          if (newPassword || error) {
            return t('Return to sign in')
          }
          if (isActive) {
            return t('auth.resetPasswordConfirm.retry', {
              seconds: secondsLeft,
            })
          }
          return t('auth.resetPasswordConfirm.confirm')
        })()}
      </AuthSubmitButton>
    </AuthCard>
  )
}
