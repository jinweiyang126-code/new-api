/*
Copyright (C) 2023-2026 QuantumNous
*/
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { UpstreamCredential } from '../types'

export type UpstreamDialogType =
  | 'create'
  | 'update'
  | 'delete'
  | 'enable'
  | 'disable'

type UpstreamContextType = {
  open: UpstreamDialogType | null
  setOpen: (str: UpstreamDialogType | null) => void
  currentRow: UpstreamCredential | null
  setCurrentRow: React.Dispatch<
    React.SetStateAction<UpstreamCredential | null>
  >
  refreshTrigger: number
  triggerRefresh: () => void
  customerId: number
}

const UpstreamContext = React.createContext<UpstreamContextType | null>(null)

export function UpstreamProvider({
  children,
  customerId,
}: {
  children: React.ReactNode
  customerId: number
}) {
  const [open, setOpen] = useDialogState<UpstreamDialogType>(null)
  const [currentRow, setCurrentRow] = useState<UpstreamCredential | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <UpstreamContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
        customerId,
      }}
    >
      {children}
    </UpstreamContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUpstream = () => {
  const ctx = React.useContext(UpstreamContext)
  if (!ctx) {
    throw new Error('useUpstream has to be used within <UpstreamProvider>')
  }
  return ctx
}
