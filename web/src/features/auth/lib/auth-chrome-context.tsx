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
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthChromeAction = {
  label: string
  onClick: () => void
} | null

type AuthChromeContextValue = {
  action: AuthChromeAction
  setAction: (action: AuthChromeAction) => void
}

const AuthChromeContext = createContext<AuthChromeContextValue | null>(null)

export function AuthChromeProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<AuthChromeAction>(null)
  const setAction = useCallback((next: AuthChromeAction) => {
    setActionState(next)
  }, [])
  const value = useMemo(
    () => ({ action, setAction }),
    [action, setAction]
  )
  return (
    <AuthChromeContext.Provider value={value}>
      {children}
    </AuthChromeContext.Provider>
  )
}

export function useAuthChrome() {
  const ctx = useContext(AuthChromeContext)
  if (!ctx) {
    throw new Error('useAuthChrome must be used within AuthChromeProvider')
  }
  return ctx
}

export function useAuthChromeOptional() {
  return useContext(AuthChromeContext)
}
