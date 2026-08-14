/*
Copyright (C) 2023-2026 QuantumNous
*/
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { Workspace } from '../types'

export type WorkspacesDialogType = 'create' | 'update' | 'disable' | 'enable'

type WorkspacesContextType = {
  open: WorkspacesDialogType | null
  setOpen: (str: WorkspacesDialogType | null) => void
  currentRow: Workspace | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Workspace | null>>
  refreshTrigger: number
  triggerRefresh: () => void
  isAdmin: boolean
  currentWorkspaceId: number
}

const WorkspacesContext = React.createContext<WorkspacesContextType | null>(
  null
)

export function WorkspacesProvider({
  children,
  isAdmin,
  currentWorkspaceId,
}: {
  children: React.ReactNode
  isAdmin: boolean
  currentWorkspaceId: number
}) {
  const [open, setOpen] = useDialogState<WorkspacesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Workspace | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <WorkspacesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
        isAdmin,
        currentWorkspaceId,
      }}
    >
      {children}
    </WorkspacesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspaces = () => {
  const ctx = React.useContext(WorkspacesContext)
  if (!ctx) {
    throw new Error('useWorkspaces has to be used within <WorkspacesProvider>')
  }
  return ctx
}
