/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'

import { updateWorkspace } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { WORKSPACE_STATUS } from '../constants'
import { useWorkspaces } from './workspaces-provider'

export function WorkspacesStatusDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { open, setOpen, currentRow, triggerRefresh } = useWorkspaces()
  const [pending, setPending] = useState(false)

  const disabling = open === 'disable'
  const enabling = open === 'enable'
  const visible = disabling || enabling

  const handleConfirm = async () => {
    if (!currentRow) return
    setPending(true)
    try {
      const next = disabling
        ? WORKSPACE_STATUS.DISABLED
        : WORKSPACE_STATUS.ENABLED
      const res = await updateWorkspace(currentRow.id, { status: next })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to update workspace'))
        return
      }
      toast.success(t('Workspace updated'))
      setOpen(null)
      triggerRefresh()
      void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDialog
      open={visible}
      onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      title={disabling ? t('Disable workspace') : t('Enable workspace')}
      desc={
        disabling
          ? t('Disable workspace {{name}}? Tokens in this workspace will stop working.', {
              name: currentRow?.name ?? '',
            })
          : t('Enable workspace {{name}}?', {
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
