/*
Copyright (C) 2023-2026 QuantumNous
*/
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { Invitation } from '../types'

export type MembersDialogType = 'invite' | 'remove-member' | 'revoke-invite'

export type MemberRow = {
  id: number
  user_id: number
  username?: string
  role: string
  status: number
  created_at: number
  /** customer = org-wide list (personal context); workspace = focused workspace */
  scope: 'customer' | 'workspace'
}

type MembersContextType = {
  open: MembersDialogType | null
  setOpen: (str: MembersDialogType | null) => void
  currentMember: MemberRow | null
  setCurrentMember: React.Dispatch<React.SetStateAction<MemberRow | null>>
  currentInvitation: Invitation | null
  setCurrentInvitation: React.Dispatch<
    React.SetStateAction<Invitation | null>
  >
  refreshTrigger: number
  triggerRefresh: () => void
  customerId: number
  isAdmin: boolean
  isPersonal: boolean
  currentWorkspaceId: number
  currentWorkspaceName: string
}

const MembersContext = React.createContext<MembersContextType | null>(null)

export function MembersProvider({
  children,
  customerId,
  isAdmin,
  isPersonal,
  currentWorkspaceId,
  currentWorkspaceName,
}: {
  children: React.ReactNode
  customerId: number
  isAdmin: boolean
  isPersonal: boolean
  currentWorkspaceId: number
  currentWorkspaceName: string
}) {
  const [open, setOpen] = useDialogState<MembersDialogType>(null)
  const [currentMember, setCurrentMember] = useState<MemberRow | null>(null)
  const [currentInvitation, setCurrentInvitation] =
    useState<Invitation | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <MembersContext
      value={{
        open,
        setOpen,
        currentMember,
        setCurrentMember,
        currentInvitation,
        setCurrentInvitation,
        refreshTrigger,
        triggerRefresh,
        customerId,
        isAdmin,
        isPersonal,
        currentWorkspaceId,
        currentWorkspaceName,
      }}
    >
      {children}
    </MembersContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMembers = () => {
  const ctx = React.useContext(MembersContext)
  if (!ctx) {
    throw new Error('useMembers has to be used within <MembersProvider>')
  }
  return ctx
}
