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
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'

test('visible statistics count from zero to their target and cancel pending animation on unmount', async () => {
  const window = new Window()
  const saved = new Map()
  const frames = new Map()
  let nextFrame = 0
  let onIntersection
  const globals = {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    performance: {
      now: () => 0,
      mark() {},
      measure() {
        return { duration: 0 }
      },
      clearMarks() {},
      clearMeasures() {},
    },
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback)
      return nextFrame
    },
    cancelAnimationFrame(id) {
      frames.delete(id)
    },
    IntersectionObserver: class {
      constructor(callback) {
        onIntersection = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  }
  window.matchMedia = () => ({ matches: false })
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  const source = readFileSync(
    new URL('../stat-counter.tsx', import.meta.url),
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
  const container = window.document.createElement('div')
  window.document.body.append(container)
  const root = createRoot(container)
  try {
    await act(() =>
      root.render(
        createElement(module.exports.StatCounter, { end: 100, suffix: '+' })
      )
    )
    assert.equal(container.textContent, '0+')
    await act(() => onIntersection([{ isIntersecting: true }]))
    const tick = (time) => {
      const pending = [...frames.values()]
      frames.clear()
      for (const frame of pending) frame(time)
    }
    tick(1200)
    assert.equal(container.textContent, '75+')
    tick(2400)
    assert.equal(container.textContent, '100+')
    assert.equal(frames.size, 0)
    await act(() =>
      root.render(
        createElement(module.exports.StatCounter, { end: 200, suffix: '+' })
      )
    )
    await act(() => onIntersection([{ isIntersecting: true }]))
    assert.equal(frames.size, 1)
    await act(() => root.unmount())
    assert.equal(frames.size, 0)
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    await window.happyDOM.abort()
  }
})
