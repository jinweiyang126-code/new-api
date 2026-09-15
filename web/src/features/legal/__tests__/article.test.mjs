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
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

import { transformSync } from 'esbuild'
import { Window } from 'happy-dom'
import { createInstance } from 'i18next'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { I18nextProvider } = createRequire(import.meta.url)('react-i18next')

const source = readFileSync(
  new URL('../legal-article.tsx', import.meta.url),
  'utf8'
)
const compiled = transformSync(source, {
  loader: 'tsx',
  format: 'cjs',
  jsx: 'automatic',
}).code
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  createRequire(import.meta.url),
  module,
  module.exports
)
const css = readFileSync(
  new URL('../../../styles/landing-theme.css', import.meta.url),
  'utf8'
)
const i18n = createInstance()
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  resources: { en: { translation: {} } },
})

for (const [name, title, headingCount, lastSection] of [
  ['privacy-policy', 'Privacy Policy', 24, '8. Eligibility'],
  ['terms-of-service', 'Terms of Service', 51, '20. Contact Information'],
]) {
  test(`${title} preserves Figma copy and typography, with neutral email and website links`, async () => {
    const document = JSON.parse(
      readFileSync(new URL(`../content/${name}.json`, import.meta.url), 'utf8')
    )
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(module.exports.LegalArticle, { document })
      )
    )
    for (const theme of ['light', 'dark']) {
      const window = new Window()
      window.document.documentElement.className = theme
      window.document.body.innerHTML = `<style>${css}</style><div class="landing-theme">${markup}</div>`
      const article = window.document.querySelector('article')
      assert.equal(article.querySelector('h1').textContent, title)
      assert.equal(article.querySelectorAll('h2,h3').length, headingCount)
      assert.ok(article.textContent.includes('Last Updated: August 31, 2026'))
      assert.ok(article.textContent.includes(lastSection))
      const bodyStyle = window.getComputedStyle(article)
      assert.equal(bodyStyle.fontSize, '16px')
      assert.equal(bodyStyle.fontWeight, '400')
      assert.equal(bodyStyle.lineHeight, '26px')
      assert.equal(
        window.getComputedStyle(article.querySelector('h1')).fontSize,
        '24px'
      )
      assert.equal(
        window.getComputedStyle(article.querySelector('h1')).fontWeight,
        '500'
      )
      assert.equal(
        window.getComputedStyle(article.querySelector('h3')).fontSize,
        '20px'
      )
      const links = article.querySelectorAll('a')
      assert.ok(links.length > 0)
      for (const link of links) {
        assert.equal(window.getComputedStyle(link).color, 'inherit')
        assert.equal(window.getComputedStyle(link).textDecoration, 'none')
        assert.ok(!/[.;]$/.test(link.getAttribute('href')))
      }
      assert.ok(article.querySelector('a[href="https://unionmeta.ai/"]'))
      if (name === 'privacy-policy') {
        assert.equal(article.querySelectorAll('th[scope="col"]').length, 3)
        assert.equal(article.querySelectorAll('td').length, 3)
        assert.equal(
          window.getComputedStyle(article.querySelector('[role="region"]'))
            .overflowX,
          'auto'
        )
      } else {
        assert.ok(
          article.querySelector('a[href="mailto:support@unionmeta.com"]')
        )
        assert.equal(article.querySelectorAll('table').length, 0)
      }
      await window.happyDOM.abort()
    }
  })
}
