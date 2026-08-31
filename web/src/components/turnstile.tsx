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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  loadTurnstileScript,
  removeTurnstileScript,
} from './turnstile-script'

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onReady?: () => void
  className?: string
}

type LoadState = 'loading' | 'ready' | 'error'

const MAX_AUTO_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 2000, 4000]
/** After render(), keep our overlay until the widget DOM appears (or timeout). */
const WIDGET_VISIBLE_TIMEOUT_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForWidgetDom(
  host: HTMLElement,
  signal: { cancelled: boolean }
): Promise<void> {
  if (host.querySelector('iframe, input[name="cf-turnstile-response"]')) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const finish = () => {
      observer.disconnect()
      window.clearTimeout(timeoutId)
      resolve()
    }

    const observer = new MutationObserver(() => {
      if (signal.cancelled) {
        finish()
        return
      }
      if (host.querySelector('iframe, input[name="cf-turnstile-response"]')) {
        finish()
      }
    })
    observer.observe(host, { childList: true, subtree: true })

    const timeoutId = window.setTimeout(finish, WIDGET_VISIBLE_TIMEOUT_MS)
  })
}

export function TurnstileLoadingPlaceholder({
  className,
}: {
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground flex h-[65px] w-[300px] max-w-full items-center justify-center gap-2 rounded-md border px-3 text-sm',
        className
      )}
      aria-busy='true'
    >
      <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
      <span className='min-w-0 leading-5'>
        {t('Please wait a moment, human check is initializing...')}
      </span>
    </div>
  )
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
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    onVerifyRef.current = onVerify
  }, [onVerify])
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  const unmountWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile?.remove) {
      try {
        window.turnstile.remove(widgetIdRef.current)
      } catch {
        /* empty */
      }
      widgetIdRef.current = null
    }
  }, [])

  const handleRetry = useCallback(() => {
    onExpireRef.current?.()
    setLoadState('loading')
    setRetryToken((n) => n + 1)
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }

    const mount = async () => {
      setLoadState('loading')
      let lastError: unknown

      for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
        if (signal.cancelled) return
        try {
          const forceReload = attempt > 0
          await loadTurnstileScript(forceReload)
          if (signal.cancelled || !ref.current || !window.turnstile) return

          unmountWidget()
          ref.current.innerHTML = ''

          const widgetId = window.turnstile.render(ref.current, {
            sitekey: siteKey,
            callback: (token: string) => onVerifyRef.current(token),
            'error-callback': () => {
              onExpireRef.current?.()
              if (!signal.cancelled) setLoadState('error')
            },
            'expired-callback': () => onExpireRef.current?.(),
          })
          widgetIdRef.current = widgetId

          // Keep overlay until CF injects iframe / response field (slow networks).
          await waitForWidgetDom(ref.current, signal)
          if (signal.cancelled) return

          setLoadState('ready')
          onReadyRef.current?.()
          return
        } catch (err) {
          lastError = err
          removeTurnstileScript()
          if (attempt < MAX_AUTO_RETRIES) {
            await sleep(RETRY_DELAYS_MS[attempt] ?? 4000)
          }
        }
      }

      if (!signal.cancelled && lastError) setLoadState('error')
    }

    void mount()

    return () => {
      signal.cancelled = true
      unmountWidget()
    }
  }, [siteKey, retryToken, unmountWidget])

  return (
    <div className={cn('relative h-[65px] w-[300px] max-w-full', className)}>
      {loadState === 'loading' ? (
        <div className='bg-muted text-muted-foreground absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-md border px-3 text-sm'>
          <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
          <span className='min-w-0 leading-5'>
            {t('Please wait a moment, human check is initializing...')}
          </span>
        </div>
      ) : null}
      {loadState === 'error' ? (
        <button
          type='button'
          onClick={handleRetry}
          className='text-destructive hover:bg-destructive/5 absolute inset-0 z-10 flex items-center justify-center gap-1 rounded-md border border-dashed px-3 text-sm'
        >
          <span>{t('Failed to load')}</span>
          <span className='underline underline-offset-2'>{t('Retry')}</span>
        </button>
      ) : null}
      <div
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center',
          loadState !== 'ready' && 'invisible'
        )}
        aria-busy={loadState === 'loading'}
      />
    </div>
  )
}
