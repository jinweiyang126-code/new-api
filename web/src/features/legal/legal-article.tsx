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
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

export type LegalBlock = {
  type: string
  text?: string
  weight?: string
  leading?: number
  tracking?: number
  items?: string[]
  ordered?: boolean
}

export type LegalArticleContent = {
  title: string
  blocks: LegalBlock[]
  table?: { headers: string[]; cells: LegalBlock[][] }
}

function LegalText(props: { text: string }) {
  const { t } = useTranslation()
  const parts = t(props.text).split(
    /(https?:\/\/[^\s]+|[\w.%+-]+@[\w.-]+\.[a-z]{2,})/gi
  )

  return parts.map((part, index) => {
    const key = parts.slice(0, index + 1).join('')
    if (!/^(https?:\/\/|[\w.%+-]+@)/i.test(part)) {
      return <Fragment key={key}>{part}</Fragment>
    }
    const address = part.replace(/[),;.!?"']+$/, '')
    const href = address.startsWith('http') ? address : `mailto:${address}`
    return (
      <Fragment key={key}>
        <a href={href}>{address}</a>
        {part.slice(address.length)}
      </Fragment>
    )
  })
}

function LegalBlocks(props: { blocks: LegalBlock[] }) {
  const weights: Record<string, number> = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  }

  return props.blocks.map((block) => {
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List key={block.items?.join('|')}>
          {block.items?.map((item) => (
            <li key={item}>
              <LegalText text={item} />
            </li>
          ))}
        </List>
      )
    }
    if (block.type === 'h2' || block.type === 'h3') {
      const Heading = block.type
      return (
        <Heading
          key={block.text}
          style={{
            fontWeight: weights[block.weight ?? 'medium'],
            lineHeight: `${block.leading}px`,
            letterSpacing: `${block.tracking}px`,
          }}
        >
          <LegalText text={block.text ?? ''} />
        </Heading>
      )
    }
    return (
      <p key={block.text}>
        <LegalText text={block.text ?? ''} />
      </p>
    )
  })
}

export function LegalArticle(props: { document: LegalArticleContent }) {
  const { t } = useTranslation()
  return (
    <article className='legal-article mx-auto w-full max-w-[960px]'>
      <h1>{t(props.document.title)}</h1>
      <div className='legal-article-body'>
        <LegalBlocks blocks={props.document.blocks} />
      </div>
      {props.document.table && (
        <div
          className='legal-table-scroll'
          role='region'
          aria-label={t('Categories of Personal Data')}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {props.document.table.headers.map((heading) => (
                  <th key={heading} scope='col'>
                    {t(heading)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {props.document.table.cells.map((cell, index) => (
                  <td key={props.document.table?.headers[index]}>
                    <LegalBlocks blocks={cell} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
