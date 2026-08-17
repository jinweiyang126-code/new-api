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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { cn } from '@/lib/utils'

type ExperienceMode = 'images' | 'videos'

type ExperienceShellProps = {
  mode: ExperienceMode
  logsLabel: string
  logsTo: string
  form: ReactNode
  formFooter?: ReactNode
  canvas: ReactNode
  wireframeHint?: string
}

/**
 * Experience Center shell: Image/Video tabs, left composer, right canvas.
 */
export function ExperienceShell({
  mode,
  logsLabel,
  logsTo,
  form,
  formFooter,
  canvas,
  wireframeHint,
}: ExperienceShellProps) {
  const { t } = useTranslation()

  return (
    <Main className='min-h-0 overflow-hidden p-0'>
      <div className='flex h-full min-h-0 flex-col'>
        <header className='border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5'>
          <nav className='flex items-center gap-5 text-sm'>
            <Link
              to='/experience/images'
              className={cn(
                'border-b-2 pb-2 font-medium transition-colors',
                mode === 'images'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              {t('Image')}
            </Link>
            <Link
              to='/experience/videos'
              className={cn(
                'border-b-2 pb-2 font-medium transition-colors',
                mode === 'videos'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              {t('Video')}
            </Link>
          </nav>
          <div className='flex min-w-0 items-center gap-3'>
            {wireframeHint ? (
              <p className='text-amber-700 dark:text-amber-400 hidden truncate text-xs md:block'>
                {wireframeHint}
              </p>
            ) : null}
            <Link
              to={logsTo}
              className='text-muted-foreground hover:text-foreground shrink-0 text-sm underline-offset-4 hover:underline'
            >
              {logsLabel}
            </Link>
          </div>
        </header>

        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1',
            'lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]'
          )}
        >
          <aside className='border-border/70 flex min-h-0 flex-col border-b lg:border-r lg:border-b-0'>
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-5'>
              {form}
            </div>
            {formFooter ? (
              <div className='border-border/70 bg-background shrink-0 border-t p-4 sm:p-5'>
                {formFooter}
              </div>
            ) : null}
          </aside>
          <section className='bg-muted/20 flex min-h-0 flex-col overflow-hidden p-4 sm:p-5'>
            {canvas}
          </section>
        </div>
      </div>
    </Main>
  )
}
