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

test('landing header becomes frosted on scroll and returns to transparent at the top', () => {
  const window = new Window()
  const document = window.document
  document.documentElement.className = 'dark'
  document.body.innerHTML = `<style>${css}</style><div class="landing-theme"><header style="position: fixed; left: 0; right: 0"><div style="max-width: 1200px"><nav></nav></div></header></div>`
  const header = document.querySelector('header')
  const nav = document.querySelector('nav')
  const headerStyle = window.getComputedStyle(header)
  assert.equal(headerStyle.left, '0px')
  assert.equal(headerStyle.right, '0px')
  assert.equal(headerStyle.backgroundColor, 'transparent')
  assert.equal(headerStyle.getPropertyValue('backdrop-filter'), 'none')
  nav.className = 'backdrop-blur-[2px]'
  header.style.setProperty('--scroll-state', '1')
  assert.notEqual(
    window.getComputedStyle(header).backgroundColor,
    'transparent'
  )
  assert.equal(
    window.getComputedStyle(header).getPropertyValue('backdrop-filter'),
    'blur(16px)'
  )
  nav.className = ''
  header.style.setProperty('--scroll-state', '0')
  assert.equal(window.getComputedStyle(header).backgroundColor, 'transparent')
  assert.equal(window.getComputedStyle(nav).backgroundColor, 'transparent')
  assert.equal(window.getComputedStyle(nav).boxShadow, 'none')
  window.happyDOM.abort()
})
