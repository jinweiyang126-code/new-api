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

  const workspaces = ctx?.workspaces ?? []

  const memberWorkspaces = useMemo(() => {
    if (!currentMember) return []
    const memberIds = new Set(currentMember.workspace_ids ?? [])
    return workspaces.filter((ws) => memberIds.has(ws.id))
  }, [currentMember, workspaces])

  const workspaceItems = useMemo(
    () =>
      memberWorkspaces.map((ws) => ({
        value: String(ws.id),
        label: ws.name,
      })),
    [memberWorkspaces]
  )

  const lockedWorkspaceId =
    currentWorkspaceId > 0 &&
    (currentMember?.workspace_ids ?? []).includes(currentWorkspaceId)
      ? currentWorkspaceId
      : 0

  const selectedWorkspaceName = useMemo(() => {
    const id = lockedWorkspaceId || Number(workspaceId) || 0
    if (id <= 0) return ''
    return (
      memberWorkspaces.find((ws) => ws.id === id)?.name ||
      currentWorkspaceName ||
      `#${id}`
    )
  }, [
    lockedWorkspaceId,
    workspaceId,
    memberWorkspaces,
    currentWorkspaceName,
  ])

  useEffect(() => {
    if (!mode || !currentMember) return
    setAmount('')
    if (lockedWorkspaceId > 0) {
      setWorkspaceId(String(lockedWorkspaceId))
      return
    }
    if (memberWorkspaces.length === 1) {
      setWorkspaceId(String(memberWorkspaces[0].id))
      return
    }
    setWorkspaceId('')
  }, [mode, lockedWorkspaceId, currentMember, memberWorkspaces])

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
      void queryClient.invalidateQueries({ queryKey: ['self-org-wallet-ledger'] })
      void queryClient.invalidateQueries({ queryKey: ['members-table'] })
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
            {lockedWorkspaceId > 0 ? (
              <div className='border-input bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm font-medium'>
                {selectedWorkspaceName}
              </div>
            ) : memberWorkspaces.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('Member is not in any workspace yet.')}
              </p>
            ) : (
              <Select
                value={workspaceId}
                items={workspaceItems}
                onValueChange={(value) => {
                  if (value != null) setWorkspaceId(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select workspace')} />
                </SelectTrigger>
                <SelectContent>
                  {memberWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={String(ws.id)}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            disabled={
              pending ||
              wsId <= 0 ||
              quotaValue <= 0 ||
              memberWorkspaces.length === 0
            }
            onClick={() => void handleSubmit()}
          >
            {mode === 'allocate' ? t('Allocate wallet') : t('Revoke wallet')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
