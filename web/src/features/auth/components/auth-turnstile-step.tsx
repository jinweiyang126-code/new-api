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
import { useTranslation } from 'react-i18next'

import { Turnstile, TurnstileLoadingPlaceholder } from '@/components/turnstile'

import { AuthBrand } from './auth-brand'
import { AuthCard } from './auth-card'

type AuthTurnstileStepProps = {
  siteKey: string
  enabled: boolean
  onVerify: (token: string) => void
  onExpire: () => void
}

export function AuthTurnstileStep({
  siteKey,
  enabled,
  onVerify,
  onExpire,
}: AuthTurnstileStepProps) {
  const { t } = useTranslation()

  return (
    <AuthCard className='flex flex-col items-center gap-6 text-center'>
      <AuthBrand />
      <div className='space-y-2'>
        <h1 className='text-lg font-semibold leading-7 tracking-[-0.09px]'>
          {t('Performing security authentication')}
        </h1>
        <p className='text-muted-foreground text-sm leading-5'>
          {t(
            'This website uses security services to protect against automated abuse. Complete the check to continue.'
          )}
        </p>
      </div>
      <div className='flex justify-center'>
        {enabled ? (
          <Turnstile
            siteKey={siteKey}
            onVerify={onVerify}
            onExpire={onExpire}
          />
        ) : (
          <TurnstileLoadingPlaceholder />
        )}
      </div>
    </AuthCard>
  )
}
