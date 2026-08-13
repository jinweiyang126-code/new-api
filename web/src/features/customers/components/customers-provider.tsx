/*
Copyright (C) 2023-2026 QuantumNous
*/
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { CustomersDialogType } from '../constants'
import type { Customer } from '../types'

type CustomersContextType = {
  open: CustomersDialogType | null
  setOpen: (str: CustomersDialogType | null) => void
  currentRow: Customer | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Customer | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const CustomersContext = React.createContext<CustomersContextType | null>(null)

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<CustomersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Customer | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <CustomersContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </CustomersContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCustomers = () => {
  const ctx = React.useContext(CustomersContext)
  if (!ctx) {
    throw new Error('useCustomers has to be used within <CustomersProvider>')
  }
  return ctx
}
