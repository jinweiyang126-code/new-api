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

const source = readFileSync(
  new URL('../get-in-touch-dialog.tsx', import.meta.url),
  'utf8'
)

test('contact dialog enlarges the close icon and centers content with equal vertical spacing', () => {
  const popup = source.match(/contentClassName='([^']+)'/)[1].split(' ')
  assert.ok(popup.includes('[&_[data-slot=dialog-close]]:size-7'))
  assert.ok(popup.includes('[&_[data-slot=dialog-close]_svg]:size-7!'))
  const body = source.match(/className='([^']*gap-11[^']*)'/)[1].split(' ')
  assert.ok(body.includes('justify-center'))
  assert.ok(body.includes('py-16'))
  assert.ok(
    !body.some((value) => value.startsWith('pt-') || value.startsWith('pb-'))
  )
})
