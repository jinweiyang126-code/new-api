/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'

import { updateUpstreamCredential } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { CREDENTIAL_STATUS } from '../constants'
import { useUpstream } from './upstream-provider'

export function UpstreamStatusDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, customerId, triggerRefresh } =
    useUpstream()
  const [pending, setPending] = useState(false)

  const disabling = open === 'disable'
  const enabling = open === 'enable'
  const visible = disabling || enabling

  const handleConfirm = async () => {
    if (!currentRow) return
    setPending(true)
    try {
      const next = disabling
        ? CREDENTIAL_STATUS.DISABLED
        : CREDENTIAL_STATUS.ENABLED
      const res = await updateUpstreamCredential(customerId, currentRow.id, {
        status: next,
      })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to update credential'))
        return
      }
      toast.success(
        disabling ? t('Credential disabled') : t('Credential enabled')
      )
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
      title={disabling ? t('Disable credential') : t('Enable credential')}
      desc={
        disabling
          ? t(
              'Disable credential {{name}}? It will stop participating in BYOK routing.',
              { name: currentRow?.name ?? '' }
            )
          : t('Enable credential {{name}}?', {
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
