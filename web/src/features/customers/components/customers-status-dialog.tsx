/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { apiErrorMessage } from '@/features/customer-org/lib/api-message'

import { updateCustomer } from '../api'
import { CUSTOMER_STATUS } from '../constants'
import { useCustomers } from './customers-provider'

export function CustomersStatusDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useCustomers()
  const [pending, setPending] = useState(false)

  const disabling = open === 'disable'
  const enabling = open === 'enable'
  const visible = disabling || enabling

  const handleConfirm = async () => {
    if (!currentRow) return
    setPending(true)
    try {
      const next = disabling ? CUSTOMER_STATUS.DISABLED : CUSTOMER_STATUS.ENABLED
      const res = await updateCustomer(currentRow.id, { status: next })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to update customer'))
        return
      }
      toast.success(disabling ? t('Customer disabled') : t('Customer enabled'))
      setOpen(null)
      triggerRefresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDialog
      open={visible}
      onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      title={disabling ? t('Disable customer') : t('Enable customer')}
      desc={
        disabling
          ? t('Disable customer {{name}}? Workspace tokens for this customer will stop working.', {
              name: currentRow?.name ?? '',
            })
          : t('Enable customer {{name}}?', {
              name: currentRow?.name ?? '',
            })
      }
      confirmText={disabling ? t('Disable') : t('Enable')}
      destructive={disabling}
      isLoading={pending}
      handleConfirm={() => void handleConfirm()}
    />
  )
}
