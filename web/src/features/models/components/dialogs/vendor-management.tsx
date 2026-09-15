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
import { useEffect, useState } from 'react'

import type { Vendor } from '../../types'
import { VendorManagementDialog } from './vendor-management-dialog'
import { VendorMutateDialog } from './vendor-mutate-dialog'

type VendorManagementProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type VendorView = 'list' | 'form'

export function VendorManagement({ open, onOpenChange }: VendorManagementProps) {
  const [view, setView] = useState<VendorView>('list')
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('list')
      setCurrentVendor(null)
    }
  }, [open])

  const handleListOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setView('list')
      setCurrentVendor(null)
      onOpenChange(false)
    }
  }

  const handleFormOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setView('list')
      setCurrentVendor(null)
    }
  }

  const handleCreate = () => {
    setCurrentVendor(null)
    setView('form')
  }

  const handleEdit = (vendor: Vendor) => {
    setCurrentVendor(vendor)
    setView('form')
  }

  return (
    <>
      <VendorManagementDialog
        open={open && view === 'list'}
        onOpenChange={handleListOpenChange}
        onCreateVendor={handleCreate}
        onEditVendor={handleEdit}
      />
      <VendorMutateDialog
        open={open && view === 'form'}
        onOpenChange={handleFormOpenChange}
        currentVendor={currentVendor}
      />
    </>
  )
}
