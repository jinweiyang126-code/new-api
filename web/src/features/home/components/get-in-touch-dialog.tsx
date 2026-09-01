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

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'
import {
  LANDING_BRAND_NAME,
  LANDING_LOGO_LIGHT_SRC,
  LANDING_LOGO_SRC,
} from '@/features/home/lib/landing-brand'

import { IconSecuritySetting } from './landing-figma-icons'

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
  const title = t('Get in Touch')
  const description = t(
    'Reach out to us directly via email. Our support team typically responds within 24 hours.'
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={<span className='sr-only'>{title}</span>}
      contentClassName='landing-theme gap-0 overflow-hidden rounded-[16px] border-border bg-background p-0 sm:max-w-[758px] sm:rounded-[20px] sm:p-0'
      contentHeight='auto'
      headerClassName='sr-only'
      bodyClassName='px-0 py-0'
      footerClassName='sm:mx-0 sm:mb-0 sm:justify-center sm:border-0 sm:p-0 sm:pb-16'
      footer={
        <div className='flex w-full justify-center pb-4 sm:pb-0'>
          <Button
            className='bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-[140px] rounded-full px-6 text-xs font-semibold'
            render={<a href={`mailto:${LANDING_CONTACT_EMAIL}`} />}
          >
            {t('Contact Us')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col items-center gap-8 px-9 pt-10 pb-6 sm:gap-11 sm:pt-4 sm:pb-0'>
        <div className='flex flex-col items-center gap-6 sm:gap-8'>
          <img
            src={logoSrc}
            alt={LANDING_BRAND_NAME}
            className='size-9 object-contain'
            decoding='async'
          />
          <div className='flex flex-col items-center gap-4 sm:gap-8'>
            <div className='flex max-w-[420px] flex-col items-center gap-4 text-center'>
              <h2 className='text-foreground text-[28px] leading-none font-semibold sm:text-[32px]'>
                {title}
              </h2>
              <p className='text-muted-foreground text-xs leading-normal'>
                {description}
              </p>
            </div>
            <a
              href={`mailto:${LANDING_CONTACT_EMAIL}`}
              className='border-border bg-card text-foreground hover:bg-muted/40 inline-flex items-center gap-3 rounded-[12px] border px-8 py-4 text-base transition-colors'
            >
              <IconSecuritySetting className='text-muted-foreground size-5 shrink-0' />
              <span>{LANDING_CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
