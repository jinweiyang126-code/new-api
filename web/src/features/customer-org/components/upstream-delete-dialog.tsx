/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'

import { deleteUpstreamCredential } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { useUpstream } from './upstream-provider'

export function UpstreamDeleteDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, customerId, triggerRefresh } =
    useUpstream()
  const [pending, setPending] = useState(false)

  const handleConfirm = async () => {
    if (!currentRow) return
    setPending(true)
    try {
      const res = await deleteUpstreamCredential(customerId, currentRow.id)
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to delete credential'))
        return
      }
      toast.success(t('Credential deleted'))
      setOpen(null)
      triggerRefresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDialog
      open={open === 'delete'}
      onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      title={t('Are you sure?')}
      desc={
        <>
          {t('This will permanently delete credential')}{' '}
          <span className='font-semibold'>{currentRow?.name}</span>
          {t('. This action cannot be undone.')}
        </>
      }
      confirmText={pending ? t('Deleting...') : t('Delete')}
      destructive
      isLoading={pending}
      handleConfirm={() => void handleConfirm()}
    />
  )
}
