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
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string
      remove?: (widgetId: string) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onReady?: () => void
  className?: string
}

type LoadState = 'loading' | 'ready' | 'error'

const SCRIPT_ID = 'cf-turnstile'
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window unavailable'))
  }
  if (window.turnstile) return Promise.resolve()

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

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onReady,
  className,
}: TurnstileProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onReadyRef = useRef(onReady)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    onVerifyRef.current = onVerify
  }, [onVerify])
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    let cancelled = false

    const mount = async () => {
      setLoadState('loading')
      try {
        await loadTurnstileScript()
        if (cancelled || !ref.current || !window.turnstile) return

        if (widgetIdRef.current && window.turnstile.remove) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            /* empty */
          }
          widgetIdRef.current = null
        }

        // Clear previous widget DOM before re-render
        ref.current.innerHTML = ''

        const widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerifyRef.current(token),
          'error-callback': () => {
            setLoadState('error')
            onExpireRef.current?.()
          },
          'expired-callback': () => onExpireRef.current?.(),
        })
        widgetIdRef.current = widgetId
        if (!cancelled) {
          setLoadState('ready')
          onReadyRef.current?.()
        }
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void mount()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* empty */
        }
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  return (
    <div className={cn('relative min-h-[65px]', className)}>
      {loadState === 'loading' ? (
        <div className='bg-muted/40 text-muted-foreground absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm'>
          <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
          <span>
            {t('Please wait a moment, human check is initializing...')}
          </span>
        </div>
      ) : null}
      {loadState === 'error' ? (
        <div className='text-destructive absolute inset-0 z-10 flex items-center justify-center rounded-md border border-dashed px-3 text-sm'>
          {t('Failed to load')}
        </div>
      ) : null}
      <div
        ref={ref}
        className={cn(loadState !== 'ready' && 'invisible')}
        aria-busy={loadState === 'loading'}
      />
    </div>
  )
}
