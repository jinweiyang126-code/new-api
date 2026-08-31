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
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  checked: boolean
  onCheckedChange: (nextValue: boolean) => void
  className?: string
}

function stopLabelToggle(event: MouseEvent<HTMLAnchorElement>) {
  event.stopPropagation()
}

export function LegalConsent({
  status,
  checked,
  onCheckedChange,
  className,
}: LegalConsentProps) {
  const { t } = useTranslation()
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const handleChange = (value: boolean) => {
    onCheckedChange(value === true)
  }

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <Checkbox
        id='legal-consent'
        checked={checked}
        onCheckedChange={handleChange}
        className='size-4 rounded-[4.5px] border-border bg-input shadow-none data-checked:border-primary data-checked:bg-primary dark:bg-input'
      />
      <Label
        htmlFor='legal-consent'
        className='text-muted-foreground block min-w-0 flex-1 text-left text-xs leading-normal font-normal'
      >
        {t('I agree to the')}{' '}
        {hasUserAgreement && (
          <a
            href='/user-agreement'
            target='_blank'
            rel='noopener noreferrer'
            className='auth-link'
            onClick={stopLabelToggle}
          >
            {t('Terms of Service')}
          </a>
        )}
        {hasUserAgreement && hasPrivacyPolicy && ` ${t('and')} `}
        {hasPrivacyPolicy && (
          <a
            href='/privacy-policy'
            target='_blank'
            rel='noopener noreferrer'
            className='auth-link'
            onClick={stopLabelToggle}
          >
            {t('Privacy Policy')}
          </a>
        )}
        .
      </Label>
    </div>
  )
}
