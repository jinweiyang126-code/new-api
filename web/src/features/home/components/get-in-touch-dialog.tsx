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
import {
  LANDING_BRAND_NAME,
  LANDING_LOGO_MARK_SRC,
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
  const title = t('Get in Touch')

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={<span className='sr-only'>{title}</span>}
      /* Figma 305:7391 / 305:7392 — black 70% scrim, 758px card, no ring */
      overlayClassName='bg-black/70 supports-backdrop-filter:backdrop-blur-none'
      contentClassName='landing-theme bg-background gap-0 overflow-hidden rounded-t-[16px] rounded-b-[20px] border-0 p-0 ring-0 sm:max-w-[758px] [&_[data-slot=dialog-close]]:top-6 [&_[data-slot=dialog-close]]:right-9 [&_[data-slot=dialog-close]]:size-4 [&_[data-slot=dialog-close]]:p-0 [&_[data-slot=dialog-close]]:hover:bg-transparent [&_[data-slot=dialog-close]]:hover:opacity-80'
      contentHeight='auto'
      headerClassName='sr-only'
      bodyClassName='px-0 py-0'
    >
      {/* Figma: topbar close only; body gap 44 / pb 64 / pt 16 */}
      <div className='flex flex-col items-center gap-11 px-9 pt-4 pb-16'>
        <div className='flex flex-col items-center gap-6'>
          <img
            src={LANDING_LOGO_MARK_SRC}
            alt={LANDING_BRAND_NAME}
            className='size-9 object-contain'
            decoding='async'
          />
          <div className='flex flex-col items-center gap-8'>
            <div className='flex w-[420px] max-w-full flex-col items-center gap-4 text-center'>
              <h2 className='text-foreground text-[32px] leading-none font-semibold'>
                {title}
              </h2>
              {/* Figma breaks after "email." — keep two explicit lines */}
              <p className='text-muted-foreground text-xs leading-normal'>
                <span className='block'>
                  {t('Reach out to us directly via email.')}
                </span>
                <span className='block'>
                  {t(
                    'Our support team typically responds within 24 hours.'
                  )}
                </span>
              </p>
            </div>
            <a
              href={`mailto:${LANDING_CONTACT_EMAIL}`}
              className='bg-card text-foreground hover:bg-muted/40 inline-flex items-center gap-3 rounded-[12px] border border-[#e8e8e8] px-8 py-4 text-base transition-colors dark:border-[#2e2e2e]'
            >
              <IconSecuritySetting className='text-foreground size-5 shrink-0' />
              <span>{LANDING_CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>

        <Button
          className='bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-[140px] shrink-0 rounded-full px-6 text-xs font-normal'
          render={<a href={`mailto:${LANDING_CONTACT_EMAIL}`} />}
        >
          {t('Contact Us')}
        </Button>
      </div>
    </Dialog>
  )
}
