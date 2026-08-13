/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
import { getCurrencyLabel } from '@/lib/currency'

import { getCustomer, transferQuota } from './api'
import { WORKSPACE_STATUS } from './constants'
import { useCustomerContext } from './hooks/use-customer-context'
import type { Workspace } from './types'

export function QuotaPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const workspaces = useMemo(
    () =>
      (ctx?.workspaces ?? []).filter(
        (w: Workspace) => w.status === WORKSPACE_STATUS.ENABLED
      ),
    [ctx?.workspaces]
  )

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getCustomer(customerId)
      if (!res.success || !res.data) throw new Error(res.message)
      return res.data
    },
  })

  const [workspaceId, setWorkspaceId] = useState('')
  const [amount, setAmount] = useState('')
  const dollars = parseFloat(amount) || 0
  const quotaValue = parseQuotaFromDollars(Math.abs(dollars))
  const currencyLabel = getCurrencyLabel()

  const transferMut = useMutation({
    mutationFn: async () => {
      const wid = Number(workspaceId)
      if (!wid || quotaValue <= 0) throw new Error(t('Invalid transfer amount'))
      const res = await transferQuota(wid, quotaValue)
      if (!res.success) throw new Error(res.message)
    },
    onSuccess: () => {
      toast.success(t('Quota transferred'))
      setAmount('')
      void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
      void queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-workspaces'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (ctxLoading) {
    return <div className='p-6 text-sm text-muted-foreground'>{t('Loading...')}</div>
  }
  if (!ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Quota')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('You are not a member of any customer.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  if (!ctx.is_admin) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Quota')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('Only customer admins can transfer quota.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quota')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='max-w-lg space-y-6'>
          <div className='rounded-md border px-4 py-3 text-sm'>
            <div className='text-muted-foreground'>{t('Customer balance')}</div>
            <div className='text-lg font-medium'>
              {formatQuota(customer?.quota ?? ctx.customer.quota)}
            </div>
          </div>

          <div className='space-y-3'>
            <div className='space-y-1'>
              <Label>{t('Workspace')}</Label>
              <Select
                value={workspaceId}
                items={workspaces.map((ws: Workspace) => ({
                  value: String(ws.id),
                  label: `${ws.name} (${formatQuota(ws.quota)})`,
                }))}
                onValueChange={(v) => setWorkspaceId(v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select workspace')} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws: Workspace) => (
                    <SelectItem key={ws.id} value={String(ws.id)}>
                      {ws.name} ({formatQuota(ws.quota)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label>
                {t('Amount')} ({currencyLabel})
              </Label>
              <Input
                type='number'
                min={0}
                step='0.01'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Will transfer')}: {formatQuota(quotaValue)}
              </p>
            </div>
            <Button
              disabled={
                !workspaceId || quotaValue <= 0 || transferMut.isPending
              }
              onClick={() => transferMut.mutate()}
            >
              {t('Transfer to workspace')}
            </Button>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
