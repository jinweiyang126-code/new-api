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
import { Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'
import {
  LANDING_BRAND_NAME,
  LANDING_LOGO_LIGHT_SRC,
  LANDING_LOGO_SRC,
} from '@/features/home/lib/landing-brand'

/** Hardcoded per homepage Figma rewrite (2A) — no backend config. */
export const LANDING_CONTACT_EMAIL = 'support@unionmeta.com'

type GetInTouchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GetInTouchDialog(props: GetInTouchDialogProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const logoSrc =
    resolvedTheme === 'light' ? LANDING_LOGO_LIGHT_SRC : LANDING_LOGO_SRC

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Get in Touch')}
      description={t(
        'Reach out to us directly via email. Our support team typically responds within 24 hours.'
      )}
      contentClassName='landing-theme sm:max-w-[758px]'
      contentHeight='auto'
      headerClassName='text-center sm:text-center'
      footer={
        <div className='flex w-full justify-center'>
          <Button
            className='bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-full px-6 text-xs font-semibold'
            render={<a href={`mailto:${LANDING_CONTACT_EMAIL}`} />}
          >
            {t('Contact Us')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col items-center gap-6 pb-2'>
        <img
          src={logoSrc}
          alt={LANDING_BRAND_NAME}
          className='h-9 w-auto'
          decoding='async'
        />
        <a
          href={`mailto:${LANDING_CONTACT_EMAIL}`}
          className='border-border bg-card text-foreground hover:bg-muted/40 inline-flex items-center gap-3 rounded-xl border px-8 py-4 text-base transition-colors'
        >
          <Mail className='size-5 shrink-0' />
          <span>{LANDING_CONTACT_EMAIL}</span>
        </a>
      </div>
    </Dialog>
  )
}
