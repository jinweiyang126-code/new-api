/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'

import {
  removeCustomerMember,
  removeWorkspaceMember,
  revokeInvitation,
} from '../api'
import { useMembers } from './members-provider'

export function MembersConfirmDialogs() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    open,
    setOpen,
    currentMember,
    currentInvitation,
    customerId,
    currentWorkspaceId,
    triggerRefresh,
  } = useMembers()
  const [pending, setPending] = useState(false)

  const removing = open === 'remove-member'
  const revoking = open === 'revoke-invite'

  const handleRemove = async () => {
    if (!currentMember) return
    setPending(true)
    try {
      const res =
        currentMember.scope === 'workspace'
          ? await removeWorkspaceMember(
              currentWorkspaceId,
              currentMember.user_id
            )
          : await removeCustomerMember(customerId, currentMember.user_id)
      if (!res.success) {
        toast.error(res.message || t('Failed to remove member'))
        return
      }
      toast.success(t('Member removed'))
      setOpen(null)
      triggerRefresh()
      void queryClient.invalidateQueries({ queryKey: ['customer-members'] })
      void queryClient.invalidateQueries({ queryKey: ['workspace-members'] })
      void queryClient.invalidateQueries({ queryKey: ['members-table'] })
    } finally {
      setPending(false)
    }
  }

  const handleRevoke = async () => {
    if (!currentInvitation) return
    setPending(true)
    try {
      const res = await revokeInvitation(currentInvitation.id)
      if (!res.success) {
        toast.error(res.message || t('Failed to revoke invitation'))
        return
      }
      toast.success(t('Invitation revoked'))
      setOpen(null)
      triggerRefresh()
      void queryClient.invalidateQueries({ queryKey: ['customer-invitations'] })
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={removing}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        title={t('Remove member')}
        desc={
          <>
            {t('Remove member')}{' '}
            <span className='font-semibold'>
              {currentMember?.username ||
                (currentMember ? `User #${currentMember.user_id}` : '')}
            </span>
            ?
          </>
        }
        confirmText={t('Remove')}
        destructive
        isLoading={pending}
        handleConfirm={() => void handleRemove()}
      />
      <ConfirmDialog
        open={revoking}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        title={t('Revoke invitation')}
        desc={
          <>
            {t('Revoke invitation for')}{' '}
            <span className='font-semibold'>
              {currentInvitation?.email || t('Open invite')}
            </span>
            ?
          </>
        }
        confirmText={t('Revoke')}
        destructive
        isLoading={pending}
        handleConfirm={() => void handleRevoke()}
      />
    </>
  )
}
