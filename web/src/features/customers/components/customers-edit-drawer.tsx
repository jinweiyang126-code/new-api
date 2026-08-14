/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  SideDrawerSection,
  SideDrawerSectionHeader,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { Textarea } from '@/components/ui/textarea'

import {
  createChannelBinding,
  deleteChannelBinding,
  getChannelBindings,
  getCustomer,
  updateCustomer,
  updateUpstreamSettings,
} from '../api'
import { UPSTREAM_MODE, getUpstreamModeOptions } from '../constants'
import type { Customer } from '../types'
import { ChannelPicker } from './channel-picker'
import { useCustomers } from './customers-provider'

const schema = z.object({
  name: z.string().min(1),
  remark: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

export function CustomersEditDrawer({ open, onOpenChange, customer }: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useCustomers()
  const queryClient = useQueryClient()
  const customerId = customer?.id ?? 0
  const upstreamModeOptions = getUpstreamModeOptions(t)

  const { data: detail } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const res = await getCustomer(customerId)
      if (!res.success || !res.data) throw new Error(res.message)
      return res.data
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      remark: '',
    },
  })

  const [mode, setMode] = useState(UPSTREAM_MODE.SHARED)
  const [allowFallback, setAllowFallback] = useState(true)
  const [byokEnabled, setByokEnabled] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState(0)
  const [priority, setPriority] = useState('0')

  const boundChannelIds = useMemo(
    () => bindings.map((b) => b.channel_id),
    [bindings]
  )

  useEffect(() => {
    if (!open || !current) return
    form.reset({
      name: current.name,
      remark: current.remark ?? '',
    })
    setMode(
      (current.upstream_mode as typeof mode) || UPSTREAM_MODE.SHARED
    )
    setAllowFallback(Boolean(current.allow_global_fallback))
    setByokEnabled(Boolean(current.byok_enabled))
  }, [open, current, form])

  const onSubmit = async (values: FormValues) => {
    if (!customer) return
    const res = await updateCustomer(customer.id, {
      name: values.name.trim(),
      remark: values.remark?.trim() || '',
    })
    if (!res.success) {
      toast.error(res.message || t('Failed to update customer'))
      return
    }
    toast.success(t('Customer updated'))
    void queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
    triggerRefresh()
  }

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
      if (!selectedChannelId) throw new Error(t('Please select a channel'))
      const res = await createChannelBinding(customerId, {
        channel_id: selectedChannelId,
        priority: Number.parseInt(priority, 10) || 0,
      })
      if (!res.success) throw new Error(res.message || 'failed')
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Channel binding added'))
      setSelectedChannelId(0)
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
          <SheetTitle>{t('Edit Customer')}</SheetTitle>
          <SheetDescription>
            {t('Edit customer name, remark, upstream, and channel bindings.')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-2'>
          <Form {...form}>
            <form
              id='customer-edit-profile'
              className={sideDrawerFormClassName('px-0 py-0')}
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <SideDrawerSection>
                <SideDrawerSectionHeader title={t('Basic Info')} />
                <div className='mt-3 space-y-4'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Name')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='remark'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Remark')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type='submit'
                    size='sm'
                    disabled={form.formState.isSubmitting}
                  >
                    {t('Save')}
                  </Button>
                </div>
              </SideDrawerSection>
            </form>
          </Form>

          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Upstream Settings')} />
            <div className='mt-3 space-y-4'>
              <div className='space-y-2'>
                <Label>{t('Upstream Mode')}</Label>
                <Select
                  value={mode}
                  items={upstreamModeOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onValueChange={(v) => setMode(v as typeof mode)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className='min-w-[var(--anchor-width)]'
                  >
                    {upstreamModeOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className='items-start py-2'
                      >
                        <span className='flex min-w-0 flex-col gap-0.5 whitespace-normal'>
                          <span className='font-medium'>{option.label}</span>
                          <span className='text-muted-foreground text-xs leading-snug'>
                            {option.description}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-muted-foreground text-xs'>
                  {
                    upstreamModeOptions.find((option) => option.value === mode)
                      ?.description
                  }
                </p>
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
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>
                      {b.channel_name?.trim() ||
                        `${t('Channel')} #${b.channel_id}`}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      ID {b.channel_id} · priority {b.priority}
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => removeBinding.mutate(b.id)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
              <div className='flex flex-wrap items-end gap-2'>
                <div className='min-w-56 flex-1 space-y-1'>
                  <Label>{t('Channel')}</Label>
                  <ChannelPicker
                    value={selectedChannelId}
                    excludeIds={boundChannelIds}
                    onValueChange={(id) => setSelectedChannelId(id)}
                    disabled={addBinding.isPending}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>{t('Priority')}</Label>
                  <Input
                    type='number'
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className='w-24'
                  />
                </div>
                <Button
                  size='sm'
                  className='h-8'
                  disabled={addBinding.isPending || !selectedChannelId}
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
