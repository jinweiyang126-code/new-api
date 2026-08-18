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
import { type SVGProps } from 'react'

import { cn } from '@/lib/utils'

/** Token API mark. Uses currentColor so it tracks light/dark UI chrome. */
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='token-api-logo'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='none'
      className={cn('size-6', className)}
      {...props}
    >
      <title>Token API</title>
      <circle
        cx='12'
        cy='12'
        r='11'
        stroke='currentColor'
        strokeWidth='1.75'
      />
      <path
        fill='currentColor'
        d='M6.5 7.15h11a1.1 1.1 0 1 1 0 2.2h-4.35v8.4a1.15 1.15 0 0 1-2.3 0v-8.4H6.5a1.1 1.1 0 0 1 0-2.2Z'
      />
    </svg>
  )
}
