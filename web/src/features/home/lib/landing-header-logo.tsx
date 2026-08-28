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
import { useTheme } from '@/context/theme-provider'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'

import { LANDING_LOGO_LIGHT_SRC, LANDING_LOGO_SRC } from './landing-brand'

/**
 * Figma marketing header wordmark (name baked into SVG).
 * Used on Home / Model Square while the site still runs default UnionMeta branding.
 */
export function LandingHeaderLogo(props: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const src =
    resolvedTheme === 'light' ? LANDING_LOGO_LIGHT_SRC : LANDING_LOGO_SRC
  return (
    <img
      src={src}
      alt={DEFAULT_SYSTEM_NAME}
      className={
        props.className ?? 'h-5 w-auto max-w-full object-contain object-left'
      }
      decoding='async'
      fetchPriority='high'
    />
  )
}
