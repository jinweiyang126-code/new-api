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
import { Skeleton } from '@/components/ui/skeleton'
import { LANDING_LOGO_MARK_SRC } from '@/features/home/lib/landing-brand'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO, DEFAULT_SYSTEM_NAME } from '@/lib/constants'

export function AuthBrand() {
  const { systemName, logo, loading } = useSystemConfig()
  const usingDefaultBrand =
    (!logo || logo === DEFAULT_LOGO) &&
    (!systemName || systemName === DEFAULT_SYSTEM_NAME)

  if (loading) {
    return <Skeleton className='mx-auto size-8 rounded-md' />
  }

  return (
    <img
      src={usingDefaultBrand ? LANDING_LOGO_MARK_SRC : logo}
      alt={systemName}
      className='mx-auto size-8 object-contain'
      decoding='async'
    />
  )
}
