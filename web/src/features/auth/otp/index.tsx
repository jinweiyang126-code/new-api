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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '../auth-layout'
import { AuthBrand } from '../components/auth-brand'
import { AuthCard } from '../components/auth-card'
import { OtpForm } from './components/otp-form'

export function Otp() {
  const { t } = useTranslation()
  return (
    <AuthLayout>
      <AuthCard className='space-y-6'>
        <AuthBrand />
        <div className='space-y-2 text-center'>
          <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
            {t('Two-factor Authentication')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t('Please enter the authentication code.')}
          </p>
          <p className='text-muted-foreground text-sm'>
            {t('Session expired?')}{' '}
            <Link
              to='/sign-in'
              className='text-foreground font-medium hover:underline'
            >
              {t('Re-login')}
            </Link>
          </p>
        </div>
        <OtpForm />
      </AuthCard>
    </AuthLayout>
  )
}
