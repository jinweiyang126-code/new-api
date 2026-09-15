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

const hero = readFileSync(new URL('../hero.tsx', import.meta.url), 'utf8')

test('mobile Hero CTA column stretches both buttons to the same width and restores desktop alignment', () => {
  const ctaContainer = hero.match(/className='([^']*mt-\[68px\][^']*)'/)
  assert.ok(ctaContainer)
  const classes = ctaContainer[1].split(' ')
  assert.ok(classes.includes('flex-col'))
  assert.ok(classes.includes('items-stretch'))
  assert.ok(classes.includes('w-full'))
  assert.ok(classes.includes('max-w-[240px]'))
  const buttons = [...hero.matchAll(/className='([^']*h-12[^']*)'/g)]
  assert.equal(buttons.length, 2)
  for (const button of buttons) {
    assert.ok(button[1].split(' ').includes('w-full'))
    assert.ok(button[1].split(' ').includes('md:w-auto'))
  }
  assert.ok(!classes.includes('items-center'))
  assert.ok(classes.includes('md:flex-row'))
  assert.ok(classes.includes('md:items-center'))
})
