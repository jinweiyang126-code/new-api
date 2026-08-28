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

import { PasswordInput } from '@/components/password-input'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const fieldClass =
  'h-11 rounded-xl border-border bg-input px-3 text-sm shadow-none md:text-sm'

type AuthTextFieldProps = React.ComponentProps<typeof Input> & {
  icon?: ReactNode
}

export function AuthTextField({
  icon,
  className,
  ...props
}: AuthTextFieldProps) {
  if (!icon) {
    return <Input className={cn(fieldClass, className)} {...props} />
  }

  return (
    <div className='relative'>
      <span className='text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 [&_svg]:size-5'>
        {icon}
      </span>
      <Input className={cn(fieldClass, 'ps-11', className)} {...props} />
    </div>
  )
}

type AuthPasswordFieldProps = React.ComponentProps<typeof PasswordInput> & {
  icon?: ReactNode
}

export function AuthPasswordField({
  icon,
  className,
  ...props
}: AuthPasswordFieldProps) {
  if (!icon) {
    return (
      <PasswordInput className={cn(fieldClass, 'pe-10', className)} {...props} />
    )
  }

  return (
    <div className='relative'>
      <span className='text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 z-10 size-5 -translate-y-1/2 [&_svg]:size-5'>
        {icon}
      </span>
      <PasswordInput
        className={cn(fieldClass, 'ps-11 pe-10', className)}
        {...props}
      />
    </div>
  )
}

type AuthFieldLabelProps = {
  label: string
  extra?: ReactNode
}

export function AuthFieldLabel({ label, extra }: AuthFieldLabelProps) {
  return (
    <div className='flex h-[22px] items-center justify-between'>
      <span className='text-sm leading-[22px]'>{label}</span>
      {extra}
    </div>
  )
}
