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
/**
 * Lazy KaTeX loader — keeps katex (+ CSS) out of the sync entry graph.
 * Call {@link loadKatex} before rendering math; {@link getKatexSync} for sync renderers.
 */
import type KatexApi from 'katex'

type KatexModule = typeof KatexApi

let katexModule: KatexModule | null = null
let loadPromise: Promise<KatexModule> | null = null

export function getKatexSync(): KatexModule | null {
  return katexModule
}

export function loadKatex(): Promise<KatexModule> {
  if (katexModule) return Promise.resolve(katexModule)
  if (loadPromise) return loadPromise

  loadPromise = Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css'),
  ])
    .then(([mod]) => {
      const resolved =
        (mod as { default?: KatexModule }).default ?? (mod as KatexModule)
      katexModule = resolved
      return resolved
    })
    .catch((error) => {
      loadPromise = null
      throw error
    })

  return loadPromise
}

/** True when markdown likely contains KaTeX math fences / $$ blocks. */
export function markdownNeedsKatex(markdown: string): boolean {
  if (!markdown) return false
  if (/\$\$[\s\S]+?\$\$/.test(markdown)) return true
  if (/^```(?:math|katex|latex)\b/m.test(markdown)) return true
  return false
}
