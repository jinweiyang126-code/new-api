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
import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

/** Figma UnionMeta-AI icon-quick login GitHub (`111:24`). */
export function IconGithub({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 18 18'
      xmlns='http://www.w3.org/2000/svg'
      width='18'
      height='18'
      fill='none'
      className={cn(className)}
      {...props}
    >
      <title>GitHub</title>
      <path
        d='M8.73925 0.559063C4.39634 0.559063 0.343872 4.43488 0.343872 9.21504C0.343872 13.0401 2.95409 16.2839 6.39343 17.4284C6.82665 17.5087 7.05032 17.2402 7.05032 17.012C7.05032 16.8049 7.07445 16.1234 7.07122 15.4006C4.66323 15.9247 4.17229 14.3789 4.17229 14.3789C3.77811 13.3782 3.21886 13.112 3.21886 13.112C2.43376 12.5741 3.28321 12.5869 3.28321 12.5869C4.15173 12.647 4.61134 13.4776 4.61134 13.4776C5.38367 14.8015 6.63785 14.4179 7.13135 14.1971C7.20958 13.6381 7.43405 13.2556 7.6813 13.0401C5.75825 12.8214 3.73821 12.0785 3.73821 8.76178C3.73821 7.81721 4.07647 7.04476 4.62903 6.4382C4.53923 6.21952 4.24348 5.3404 4.71261 4.1474C4.71261 4.1474 5.43964 3.91498 7.09423 5.03508C7.78421 4.84378 8.52496 4.74759 9.2604 4.74446C9.99582 4.74761 10.7375 4.84378 11.4286 5.03508C13.0812 3.915 13.8071 4.1474 13.8071 4.1474C14.2773 5.3404 13.9826 6.22061 13.8928 6.4382C14.4474 7.04476 14.7835 7.81721 14.7835 8.76178C14.7835 12.086 12.7579 12.8182 10.8306 13.0317C11.1412 13.3 11.418 13.8273 11.418 14.6345C11.418 15.7926 11.4086 16.7246 11.4086 17.0098C11.4086 17.2402 11.5639 17.5097 12.0035 17.4251C15.4407 16.2787 17.6563 13.0348 17.6563 9.21298C17.6563 4.43273 13.0612 0.557007 8.73925 0.557007V0.559063Z'
        fill='currentColor'
      />
    </svg>
  )
}
