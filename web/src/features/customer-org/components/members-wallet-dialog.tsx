/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'

import {
  allocateOrgWallet,
  getWorkspace,
  getWorkspaceOrgWallets,
  revokeOrgWallet,
} from '../api'
import { useCustomerContext } from '../hooks/use-customer-context'
import { apiErrorMessage } from '../lib/api-message'
import { useMembers } from './members-provider'

export function MembersWalletDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx } = useCustomerContext()
  const {
    open,
    setOpen,
    currentMember,
    currentWorkspaceId,
    currentWorkspaceName,
    triggerRefresh,
  } = useMembers()

  const mode =
    open === 'allocate-wallet'
      ? 'allocate'
      : open === 'revoke-wallet'
        ? 'revoke'
        : null

  const [workspaceId, setWorkspaceId] = useState('')
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!mode) return
    setAmount('')
    setWorkspaceId(currentWorkspaceId > 0 ? String(currentWorkspaceId) : '')
  }, [mode, currentWorkspaceId, currentMember?.user_id])

  const wsId = Number(workspaceId) || 0
  const dollars = parseFloat(amount) || 0
  const quotaValue = parseQuotaFromDollars(Math.abs(dollars))
  const currencyLabel = getCurrencyLabel()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', wsId],
    enabled: mode != null && wsId > 0,
    queryFn: async () => {
      const res = await getWorkspace(wsId)
      if (!res.success || !res.data) throw new Error(res.message)
      return res.data
    },
  })

  const { data: wallets = [] } = useQuery({
    queryKey: ['workspace-org-wallets', wsId],
    enabled: mode != null && wsId > 0,
    queryFn: async () => {
      const res = await getWorkspaceOrgWallets(wsId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const memberBalance = useMemo(() => {
    if (!currentMember) return 0
    return (
      wallets.find((w) => w.user_id === currentMember.user_id)?.balance ?? 0
    )
  }, [wallets, currentMember])

  const workspaces = ctx?.workspaces ?? []

  const handleSubmit = async () => {
    if (!currentMember || !mode || wsId <= 0 || quotaValue <= 0) return
    setPending(true)
    try {
      const payload = {
        user_id: currentMember.user_id,
        amount: quotaValue,
      }
      const res =
        mode === 'allocate'
          ? await allocateOrgWallet(wsId, payload)
          : await revokeOrgWallet(wsId, payload)
      if (!res.success) {
        toast.error(
          apiErrorMessage(
            t,
            res.message,
            mode === 'allocate'
              ? 'Failed to allocate wallet'
              : 'Failed to revoke wallet'
          )
        )
        return
      }
      toast.success(
        mode === 'allocate' ? t('Quota allocated') : t('Quota revoked')
      )
      setOpen(null)
      triggerRefresh()
      void queryClient.invalidateQueries({ queryKey: ['workspace-org-wallets'] })
      void queryClient.invalidateQueries({ queryKey: ['self-org-wallets'] })
      void queryClient.invalidateQueries({ queryKey: ['workspace', wsId] })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={mode != null} onOpenChange={(v) => !v && setOpen(null)}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'allocate'
              ? t('Allocate organization wallet')
              : t('Revoke organization wallet')}
          </DialogTitle>
          <DialogDescription>
            {currentMember?.username ||
              (currentMember ? `User #${currentMember.user_id}` : '')}
            {currentWorkspaceName ? ` · ${currentWorkspaceName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3 py-2'>
          <div className='grid gap-1.5'>
            <Label>{t('Workspace')}</Label>
            <Select
              value={workspaceId}
              onValueChange={(value) => {
                if (value != null) setWorkspaceId(value)
              }}
              disabled={currentWorkspaceId > 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select workspace')} />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={String(ws.id)}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='text-muted-foreground grid gap-1 text-xs'>
            <div>
              {t('Member balance')}: {formatQuota(memberBalance)}
            </div>
            <div>
              {t('Workspace allocatable')}:{' '}
              {formatQuota(workspace?.allocatable_quota ?? 0)}
            </div>
          </div>

          <div className='grid gap-1.5'>
            <Label>
              {t('Amount')} ({currencyLabel})
            </Label>
            <Input
              type='number'
              min='0'
              step='0.01'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder='0.00'
            />
            <p className='text-muted-foreground text-xs'>
              ≈ {formatQuota(quotaValue)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(null)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={pending || wsId <= 0 || quotaValue <= 0}
            onClick={() => void handleSubmit()}
          >
            {mode === 'allocate' ? t('Allocate') : t('Revoke')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
