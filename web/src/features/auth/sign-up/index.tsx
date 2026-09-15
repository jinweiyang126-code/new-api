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
import { AuthLayout } from '../auth-layout'
import { AuthFlowPreview } from '../components/auth-flow-preview'
import { AuthTurnstileStep } from '../components/auth-turnstile-step'
import { SignUpForm } from './components/sign-up-form'

type SignUpProps = {
  invite?: string
}

export function SignUp({ invite }: SignUpProps) {
  const preview = new URLSearchParams(window.location.search).get('preview')
  let content = <SignUpForm invite={invite} />
  if (preview === 'flow') content = <AuthFlowPreview mode='sign-up' />
  if (preview === 'security') {
    content = (
      <AuthTurnstileStep
        siteKey=''
        enabled={false}
        onVerify={() => undefined}
        onExpire={() => undefined}
      />
    )
  }

  return <AuthLayout>{content}</AuthLayout>
}
