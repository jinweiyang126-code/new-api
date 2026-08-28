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
import type { ReactNode } from 'react'

import { LandingHeaderLogo } from '@/features/home/lib/landing-header-logo'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO, DEFAULT_SYSTEM_NAME } from '@/lib/constants'

import type { PublicHeaderProps } from '../components/public-header'

export type LandingPublicLayoutProps = {
  showMainContainer: boolean
  className: string
  headerVariant: NonNullable<PublicHeaderProps['variant']>
  showThemeSwitch: boolean
  logo?: ReactNode
  siteName?: string
}

type UseLandingPublicLayoutOptions = {
  /** Defaults to false (full-bleed marketing pages). */
  showMainContainer?: boolean
}

/**
 * Shared Figma marketing shell for all public PublicLayout pages
 * (Home, Model Square, Rankings, About, Legal, etc.).
 */
export function useLandingPublicLayoutProps(
  options?: UseLandingPublicLayoutOptions
): LandingPublicLayoutProps {
  const { systemName, logo } = useSystemConfig()
  const usingDefaultBrand =
    (!logo || logo === DEFAULT_LOGO) &&
    (!systemName || systemName === DEFAULT_SYSTEM_NAME)

  return {
    showMainContainer: options?.showMainContainer ?? false,
    className: 'landing-theme',
    headerVariant: 'landing',
    showThemeSwitch: true,
    ...(usingDefaultBrand
      ? { logo: <LandingHeaderLogo />, siteName: '' }
      : {}),
  }
}
