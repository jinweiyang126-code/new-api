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

/** Resolve the public base URL for model relay (/v1), without trailing slash. */
export function resolvePublicApiAddress(
  status: Record<string, unknown> | null | undefined,
  fallbackOrigin?: string
): string {
  const data = (status?.data as Record<string, unknown> | undefined) ?? undefined
  const candidates = [
    status?.public_api_address,
    status?.publicApiAddress,
    data?.public_api_address,
    data?.publicApiAddress,
    status?.server_address,
    status?.serverAddress,
    data?.server_address,
    data?.serverAddress,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().replace(/\/+$/, '')
    }
  }

  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Prefer site ServerAddress for homepage / OAuth-facing links. */
export function resolveServerAddress(
  status: Record<string, unknown> | null | undefined,
  fallbackOrigin?: string
): string {
  const data = (status?.data as Record<string, unknown> | undefined) ?? undefined
  const candidates = [
    status?.server_address,
    status?.serverAddress,
    data?.server_address,
    data?.serverAddress,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().replace(/\/+$/, '')
    }
  }

  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function readStatusFromLocalStorage(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('status')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
