/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  SideDrawerSection,
  SideDrawerSectionHeader,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatQuota, formatTimestamp } from '@/lib/format'

import {
  getChannelBindings,
  getCustomer,
  getCustomerWorkspaces,
} from '../api'
import { CUSTOMER_STATUS } from '../constants'
import type { Customer } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 text-sm'>
      <span className='text-muted-foreground shrink-0'>{label}</span>
      <span className='min-w-0 text-right break-words'>{children}</span>
    </div>
  )
}

export function CustomersDetailDrawer({ open, onOpenChange, customer }: Props) {
  const { t } = useTranslation()
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

  const { data: bindings = [] } = useQuery({
    queryKey: ['customer-bindings', customerId],
    queryFn: async () => {
      const res = await getChannelBindings(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
    enabled: open && customerId > 0,
  })

  const current = detail ?? customer
  if (!current) return null

  const enabled = current.status === CUSTOMER_STATUS.ENABLED

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName()}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{current.name}</SheetTitle>
          <SheetDescription>
            {t('Customer details (read only)')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-2'>
          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Overview')} />
            <div className='mt-3 space-y-3'>
              <InfoRow label={t('Slug')}>{current.slug}</InfoRow>
              <InfoRow label={t('Status')}>
                {enabled ? (
                  <StatusBadge
                    label={t('Enabled')}
                    variant='success'
                    copyable={false}
                  />
                ) : (
                  <StatusBadge
                    label={t('Disabled')}
                    variant='danger'
                    copyable={false}
                  />
                )}
              </InfoRow>
              <InfoRow label={t('Owner')}>
                {current.owner_username ||
                  (current.owner_user_id
                    ? `#${current.owner_user_id}`
                    : '—')}
              </InfoRow>
              <InfoRow label={t('Quota')}>
                {formatQuota(current.quota)}
              </InfoRow>
              <InfoRow label={t('Used')}>
                {formatQuota(current.used_quota)}
              </InfoRow>
              <InfoRow label={t('Created At')}>
                {formatTimestamp(current.created_at)}
              </InfoRow>
              <InfoRow label={t('Remark')}>
                {current.remark?.trim() ? current.remark : '—'}
              </InfoRow>
            </div>
          </SideDrawerSection>

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
            <div className='mt-3 space-y-3'>
              <InfoRow label={t('Upstream Mode')}>
                <StatusBadge
                  label={current.upstream_mode || 'shared'}
                  variant='neutral'
                  copyable={false}
                />
              </InfoRow>
              <InfoRow label={t('Allow global fallback')}>
                {current.allow_global_fallback ? t('Yes') : t('No')}
              </InfoRow>
              <InfoRow label={t('Enable BYOK')}>
                {current.byok_enabled ? t('Yes') : t('No')}
              </InfoRow>
            </div>
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader title={t('Channel Bindings')} />
            <div className='mt-3 space-y-2'>
              {bindings.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No channel bindings')}
                </p>
              ) : (
                bindings.map((b, index) => (
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
                        ID {b.channel_id}
                      </div>
                    </div>
                    <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                      #{index + 1}
                    </span>
                  </div>
                ))
              )}
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
