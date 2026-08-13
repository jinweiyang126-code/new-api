/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  SideDrawerSectionHeader,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatQuota } from '@/lib/format'

import {
  createChannelBinding,
  deleteChannelBinding,
  getChannelBindings,
  getCustomer,
  getCustomerWorkspaces,
  updateUpstreamSettings,
} from '../api'
import { UPSTREAM_MODE } from '../constants'
import type { Customer } from '../types'
import { useCustomers } from './customers-provider'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

export function CustomersDetailDrawer({ open, onOpenChange, customer }: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useCustomers()
  const queryClient = useQueryClient()
  const customerId = customer?.id ?? 0

  const { data: detail } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const res = await getCustomer(customerId)
      if (!res.success || !res.data) throw new Error(res.message)
      return res.data
    },
    enabled: open && customerId > 0,
  })

  const { data: workspaces = [] } = useQuery({
    queryKey: ['customer-workspaces', customerId],
    queryFn: async () => {
      const res = await getCustomerWorkspaces(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
    enabled: open && customerId > 0,
  })

  const { data: bindings = [], refetch: refetchBindings } = useQuery({
    queryKey: ['customer-bindings', customerId],
    queryFn: async () => {
      const res = await getChannelBindings(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
    enabled: open && customerId > 0,
  })

  const current = detail ?? customer
  const [mode, setMode] = useState(UPSTREAM_MODE.SHARED)
  const [allowFallback, setAllowFallback] = useState(true)
  const [byokEnabled, setByokEnabled] = useState(false)
  const [channelId, setChannelId] = useState('')
  const [priority, setPriority] = useState('0')

  useEffect(() => {
    if (!current) return
    setMode((current.upstream_mode as typeof mode) || UPSTREAM_MODE.SHARED)
    setAllowFallback(Boolean(current.allow_global_fallback))
    setByokEnabled(Boolean(current.byok_enabled))
  }, [current])

  const saveUpstream = useMutation({
    mutationFn: async () => {
      const res = await updateUpstreamSettings(customerId, {
        upstream_mode: mode,
        allow_global_fallback: allowFallback,
        byok_enabled: byokEnabled,
      })
      if (!res.success) throw new Error(res.message || 'failed')
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Upstream settings saved'))
      void queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
      triggerRefresh()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Failed to save upstream settings'))
    },
  })

  const addBinding = useMutation({
    mutationFn: async () => {
      const id = parseInt(channelId, 10)
      if (!id) throw new Error(t('Invalid channel id'))
      const res = await createChannelBinding(customerId, {
        channel_id: id,
        priority: parseInt(priority, 10) || 0,
      })
      if (!res.success) throw new Error(res.message || 'failed')
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Channel binding added'))
      setChannelId('')
      void refetchBindings()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Failed to add channel binding'))
    },
  })

  const removeBinding = useMutation({
    mutationFn: async (bindingId: number) => {
      const res = await deleteChannelBinding(customerId, bindingId)
      if (!res.success) throw new Error(res.message || 'failed')
    },
    onSuccess: () => {
      toast.success(t('Channel binding removed'))
      void refetchBindings()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Failed to remove channel binding'))
    },
  })

  if (!current) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName()}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{current.name}</SheetTitle>
          <SheetDescription>
            {current.slug} · {t('Quota')}: {formatQuota(current.quota)}
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-2'>
          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Workspaces')} />
            <div className='mt-3 space-y-2'>
              {workspaces.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No workspaces')}
                </p>
              ) : (
                workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                  >
                    <div>
                      <div className='font-medium'>
                        {ws.name}
                        {ws.is_default ? (
                          <span className='text-muted-foreground ml-2 text-xs'>
                            ({t('default')})
                          </span>
                        ) : null}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {ws.slug}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div>{formatQuota(ws.quota)}</div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Used')}: {formatQuota(ws.used_quota)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Upstream Settings')} />
            <div className='mt-3 space-y-4'>
              <div className='space-y-2'>
                <Label>{t('Upstream Mode')}</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as typeof mode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UPSTREAM_MODE.SHARED}>
                      shared
                    </SelectItem>
                    <SelectItem value={UPSTREAM_MODE.DEDICATED}>
                      dedicated
                    </SelectItem>
                    <SelectItem value={UPSTREAM_MODE.BYOK}>byok</SelectItem>
                    <SelectItem value={UPSTREAM_MODE.HYBRID}>hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={allowFallback}
                  onCheckedChange={(v) => setAllowFallback(Boolean(v))}
                />
                {t('Allow global fallback')}
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={byokEnabled}
                  onCheckedChange={(v) => setByokEnabled(Boolean(v))}
                />
                {t('Enable BYOK')}
              </label>
              <Button
                size='sm'
                disabled={saveUpstream.isPending}
                onClick={() => saveUpstream.mutate()}
              >
                {t('Save Upstream Settings')}
              </Button>
            </div>
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Channel Bindings')} />
            <div className='mt-3 space-y-3'>
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                >
                  <span>
                    {t('Channel')} #{b.channel_id}
                    <span className='text-muted-foreground ml-2'>
                      priority {b.priority}
                    </span>
                  </span>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => removeBinding.mutate(b.id)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
              <div className='flex gap-2'>
                <Input
                  type='number'
                  placeholder={t('Channel ID')}
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
                <Input
                  type='number'
                  placeholder={t('Priority')}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className='w-24'
                />
                <Button
                  size='sm'
                  disabled={addBinding.isPending}
                  onClick={() => addBinding.mutate()}
                >
                  {t('Add')}
                </Button>
              </div>
            </div>
          </SideDrawerSection>
        </div>

        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button type='button' variant='outline' />}>
            {t('Close')}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
