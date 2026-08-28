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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  convertDetectedLanguage,
  normalizeInterfaceLanguage,
  type InterfaceLanguageCode,
} from './languages'
import en from './locales/en.json'

/** Locale JSON shape used by this project (`{ translation: { … } }`). */
type LocaleFile = { translation: Record<string, unknown> }

const SUPPORTED_LANGS: InterfaceLanguageCode[] = [
  'en',
  'zhCN',
  'fr',
  'ru',
  'ja',
  'vi',
  'zhTW',
]

/**
 * Lazy loaders for non-English locales. English stays sync so `fallbackLng`
 * always has a bundle without an extra network round-trip.
 */
const LOCALE_LOADERS: Record<
  Exclude<InterfaceLanguageCode, 'en'>,
  () => Promise<{ default: LocaleFile }>
> = {
  zhCN: () => import('./locales/zh.json'),
  zhTW: () => import('./locales/zh-TW.json'),
  ja: () => import('./locales/ja.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  vi: () => import('./locales/vi.json'),
}

const loadedLocales = new Set<string>(['en'])
const localeInflight = new Map<string, Promise<void>>()

function isSupportedLang(code: string): code is InterfaceLanguageCode {
  return (SUPPORTED_LANGS as string[]).includes(code)
}

/**
 * Ensure a language's `translation` namespace is registered on i18n.
 * Safe to call repeatedly; concurrent callers share one in-flight import.
 */
export async function ensureLocaleLoaded(lng: string): Promise<void> {
  const code = normalizeInterfaceLanguage(lng)
  if (loadedLocales.has(code)) return
  if (!isSupportedLang(code) || code === 'en') {
    loadedLocales.add(code)
    return
  }

  const inflight = localeInflight.get(code)
  if (inflight) {
    await inflight
    return
  }

  const loader = LOCALE_LOADERS[code]
  const promise = loader()
    .then((mod) => {
      const bundle = mod.default
      const translation =
        bundle && typeof bundle === 'object' && 'translation' in bundle
          ? bundle.translation
          : (bundle as unknown as Record<string, unknown>)
      i18n.addResourceBundle(code, 'translation', translation, true, true)
      loadedLocales.add(code)
    })
    .finally(() => {
      localeInflight.delete(code)
    })

  localeInflight.set(code, promise)
  await promise
}

/** @deprecated Prefer ensureLocaleLoaded — kept for any code that imported `resources`. */
export const resources = {
  en,
} as const

let changeLanguagePatched = false

function patchChangeLanguage() {
  if (changeLanguagePatched) return
  changeLanguagePatched = true

  const originalChangeLanguage = i18n.changeLanguage.bind(i18n)
  i18n.changeLanguage = (async (lng, ...rest) => {
    if (lng) {
      await ensureLocaleLoaded(String(lng))
    }
    return originalChangeLanguage(lng, ...rest)
  }) as typeof i18n.changeLanguage
}

/**
 * Initialize i18n: English is bundled; the detected/active language is loaded
 * before the promise resolves so the first paint is not missing keys.
 */
export async function initI18n(): Promise<typeof i18n> {
  if (!i18n.isInitialized) {
    i18n.use(LanguageDetector).use(initReactI18next)
    await i18n.init({
      resources: { en },
      fallbackLng: 'en',
      supportedLngs: [...SUPPORTED_LANGS],
      load: 'currentOnly',
      nsSeparator: false,
      debug: import.meta.env.DEV,
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        convertDetectedLanguage,
      },
      partialBundledLanguages: true,
    })
    patchChangeLanguage()
  }

  const resolved = normalizeInterfaceLanguage(
    i18n.resolvedLanguage || i18n.language || 'en'
  )
  await ensureLocaleLoaded(resolved)
  if (normalizeInterfaceLanguage(i18n.language) !== resolved) {
    await i18n.changeLanguage(resolved)
  }

  return i18n
}

export default i18n
