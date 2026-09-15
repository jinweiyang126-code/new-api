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
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildSync } from 'esbuild'
import { Window } from 'happy-dom'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const compiled = buildSync({
  entryPoints: [fileURLToPath(new URL('../models-strip.tsx', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  alias: { '@': fileURLToPath(new URL('../../../../../', import.meta.url)) },
  external: ['react', 'react/jsx-runtime', 'react-i18next'],
}).outputFiles[0].text
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  createRequire(import.meta.url),
  module,
  module.exports
)

test('mobile model logos use 3+3 rows and application logos use centered 3+2 rows', async () => {
  const window = new Window()
  window.document.body.innerHTML = renderToStaticMarkup(
    createElement(module.exports.ModelsStrip)
  )
  const strips = [...window.document.querySelectorAll('div')].filter(
    (element) => element.classList.contains('md:hidden')
  )
  assert.equal(strips.length, 2)
  assert.deepEqual(
    [...strips[0].children].map((row) =>
      [...row.querySelectorAll('p')].map((p) => p.textContent)
    ),
    [
      ['OpenAI', 'Claude', 'Gemini'],
      ['DeepSeek', 'Qwen', 'Doubao'],
    ]
  )
  assert.deepEqual(
    [...strips[1].children].map((row) =>
      [...row.querySelectorAll('p')].map((p) => p.textContent)
    ),
    [
      ['Codex', 'Claude Code', 'Cursor'],
      ['GitHub Copilot', 'Cline'],
    ]
  )
  assert.ok(strips[1].lastElementChild.classList.contains('justify-evenly'))
  assert.ok(!strips[0].classList.contains('overflow-x-auto'))
  await window.happyDOM.abort()
})
