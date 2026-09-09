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
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'

import { AuthLayout } from '../auth-layout'
import { useAuthChrome } from '../lib/auth-chrome-context'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <ForgotPasswordContent />
    </AuthLayout>
  )
}

function ForgotPasswordContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAction: setAuthChromeAction } = useAuthChrome()

  const goBack = useCallback(() => {
    void navigate({ to: '/sign-in' })
  }, [navigate])

  useEffect(() => {
    setAuthChromeAction({
      label: t('Back'),
      onClick: goBack,
    })
    return () => setAuthChromeAction(null)
  }, [setAuthChromeAction, t, goBack])

  return <ForgotPasswordForm />
}
