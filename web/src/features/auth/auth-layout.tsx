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
import { PublicHeader } from '@/components/layout'
import { LandingHeaderLogo } from '@/features/home/lib/landing-header-logo'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO, DEFAULT_SYSTEM_NAME } from '@/lib/constants'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { systemName, logo } = useSystemConfig()
  const usingDefaultBrand =
    (!logo || logo === DEFAULT_LOGO) &&
    (!systemName || systemName === DEFAULT_SYSTEM_NAME)

  return (
    <div className='auth-theme relative min-h-svh overflow-x-clip'>
      <div className='auth-glow pointer-events-none absolute inset-0' aria-hidden />
      <PublicHeader
        variant='auth'
        showNotifications={false}
        showThemeSwitch={false}
        showLanguageSwitcher={false}
        {...(usingDefaultBrand
          ? { logo: <LandingHeaderLogo />, siteName: '' }
          : {})}
      />
      <div className='relative z-10 flex min-h-svh items-center justify-center px-4 pt-20 pb-10'>
        {children}
      </div>
    </div>
  )
}
