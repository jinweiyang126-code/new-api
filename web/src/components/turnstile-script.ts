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

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string
      remove?: (widgetId: string) => void
      reset?: (widgetId?: string) => void
    }
  }
}

const SCRIPT_ID = 'cf-turnstile'
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function removeTurnstileScript() {
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) existing.remove()
}

export function loadTurnstileScript(forceReload = false): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window unavailable'))
  }
  if (window.turnstile && !forceReload) return Promise.resolve()

  if (forceReload) {
    removeTurnstileScript()
    try {
      delete (window as { turnstile?: unknown }).turnstile
    } catch {
      window.turnstile = undefined
    }
  }

  const existing = document.getElementById(
    SCRIPT_ID
  ) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve()
        return
      }
      const onLoad = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('Failed to load Turnstile'))
      }
      const cleanup = () => {
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(script)
  })
}

export function preloadTurnstileScript(): Promise<void> {
  return loadTurnstileScript()
}
