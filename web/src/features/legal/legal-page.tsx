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
import { useState } from 'react'

import { PublicLayout, useLandingPublicLayoutProps } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { GetInTouchDialog } from '@/features/home/components/get-in-touch-dialog'

import { LegalArticle, type LegalArticleContent } from './legal-article'

export function LegalPage(props: { document: LegalArticleContent }) {
  const layout = useLandingPublicLayoutProps()
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <PublicLayout {...layout}>
      <main className='px-6 pt-[112px] pb-[160px] md:pt-[144px]'>
        <LegalArticle document={props.document} />
      </main>
      <Footer
        variant='landing'
        className='border-t border-[#E8E8E8] dark:border-[#2E2E2E]'
        onContactClick={() => setContactOpen(true)}
      />
      <GetInTouchDialog open={contactOpen} onOpenChange={setContactOpen} />
    </PublicLayout>
  )
}
