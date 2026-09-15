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
import { test } from 'node:test'

import { Window } from 'happy-dom'

const css = readFileSync(
  new URL('../../../../styles/landing-theme.css', import.meta.url),
  'utf8'
)

test('light footer copyright and every legal link use #939393 without changing dark mode', async () => {
  for (const theme of ['light', 'dark']) {
    const window = new Window()
    window.document.documentElement.className = theme
    window.document.body.innerHTML = `<style>${css}</style><div class="landing-theme"><footer><div><div><p>Brand</p></div><div><p>© 2026 UnionMeta. All rights reserved.</p><nav><button>Contact Us</button><a>Terms of Service</a><a>Privacy Policy</a></nav></div></div></footer></div>`
    const row = window.document.querySelector('footer > div > div:last-child')
    for (const element of row.querySelectorAll('p, a, button')) {
      const color = window.getComputedStyle(element).color
      if (theme === 'light') assert.equal(color, '#939393')
      else assert.notEqual(color, '#939393')
    }
    assert.notEqual(
      window.getComputedStyle(window.document.querySelector('footer p')).color,
      '#939393'
    )
    await window.happyDOM.abort()
  }
})
