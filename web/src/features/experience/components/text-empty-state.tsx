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
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function TextEmptyState() {
  const { t } = useTranslation()

  return (
    <div className='flex min-h-[min(420px,calc(100svh-18rem))] flex-col items-center justify-center px-6 py-12 text-center'>
      <div className='bg-muted/40 text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-2xl border'>
        <FileText className='size-6' />
      </div>
      <h2 className='text-xl font-semibold tracking-tight md:text-2xl'>
        {t('Start your conversation')}
      </h2>
      <p className='text-muted-foreground mt-2 max-w-md text-sm leading-relaxed'>
        {t('Enter a question, or paste text for the model to process')}
      </p>
    </div>
  )
}
