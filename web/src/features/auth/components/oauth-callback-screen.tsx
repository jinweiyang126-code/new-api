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
import { useCallback, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { hideBootOAuthLoader } from '@/lib/boot-oauth-loader'

import { AuthLayout } from '../auth-layout'
import { useAuthRedirect } from '../hooks/use-auth-redirect'
import { useAuthChrome } from '../lib/auth-chrome-context'
import { AuthCard } from './auth-card'

type OAuthCallbackScreenProps = {
  provider: string
  mode: 'login' | 'bind'
}

export function OAuthCallbackScreen({ mode }: OAuthCallbackScreenProps) {
  useLayoutEffect(() => {
    hideBootOAuthLoader()
  }, [])

  return (
    <AuthLayout>
      <OAuthCallbackContent mode={mode} />
    </AuthLayout>
  )
}

function OAuthCallbackContent({ mode }: { mode: 'login' | 'bind' }) {
  const { t } = useTranslation()
  const { setAction: setAuthChromeAction } = useAuthChrome()
  const { redirectToLogin } = useAuthRedirect()
  const isBindMode = mode === 'bind'

  const goSignIn = useCallback(() => {
    redirectToLogin()
  }, [redirectToLogin])

  useEffect(() => {
    if (isBindMode) {
      setAuthChromeAction(null)
      return () => setAuthChromeAction(null)
    }
    setAuthChromeAction({
      label: t('Log in'),
      onClick: goSignIn,
    })
    return () => setAuthChromeAction(null)
  }, [isBindMode, setAuthChromeAction, t, goSignIn])

  return (
    <AuthCard className='flex w-full max-w-[408px] flex-col items-center gap-10 text-center'>
      <Loader2 className='text-primary size-10 animate-spin' aria-hidden />
      <div className='flex w-full flex-col items-center gap-2'>
        <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
          {isBindMode
            ? t('Binding your account...')
            : t('Processing OAuth response...')}
        </h1>
        <p className='text-muted-foreground text-xs leading-[1.5]'>
          {isBindMode
            ? t(
                'You can close this tab once the binding completes or a success message appears in the original window.'
              )
            : t(
                "You'll be redirected automatically. You can return to the previous page if nothing happens after a few seconds."
              )}
        </p>
      </div>
    </AuthCard>
  )
}
