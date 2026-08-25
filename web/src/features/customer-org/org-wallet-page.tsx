/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { History, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatQuota } from '@/lib/format'

import { getSelfOrgWallets, type OrgWallet } from './api'
import { useCustomerContext } from './hooks/use-customer-context'

const FILTER_ALL = 'all'

export function OrgWalletPage() {
  const { t } = useTranslation()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const workspaces = ctx?.workspaces ?? []
  const [workspaceFilter, setWorkspaceFilter] = useState(FILTER_ALL)

  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ['self-org-wallets', customerId],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getSelfOrgWallets(customerId)
      if (!res.success) throw new Error(res.message || 'failed')
      return res.data ?? []
    },
  })

  const filtered = useMemo(() => {
    if (workspaceFilter === FILTER_ALL) return wallets
    const id = Number(workspaceFilter)
    return wallets.filter((w) => w.workspace_id === id)
  }, [wallets, workspaceFilter])

  const totalBalance = useMemo(
    () => filtered.reduce((sum, w) => sum + (w.balance ?? 0), 0),
    [filtered]
  )

  const loading = ctxLoading || walletsLoading

  if (!ctxLoading && !ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('You are not a member of any customer.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Organization wallet balances are allocated by customer admins. This page is read-only.'
            )}
          </p>

          <div className='flex flex-wrap items-center gap-3'>
            <Select
              value={workspaceFilter}
              onValueChange={(value) => {
                if (value != null) setWorkspaceFilter(value)
              }}
            >
              <SelectTrigger className='w-[220px]'>
                <SelectValue placeholder={t('Workspace')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t('All')}</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={String(ws.id)}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              render={
                <Link to='/usage-logs/$section' params={{ section: 'common' }} />
              }
            >
              <History className='size-4' />
              {t('Usage Logs')}
            </Button>
          </div>

          {loading ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
              {['a', 'b', 'c'].map((k) => (
                <div key={k} className='rounded-lg border p-4'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='mt-3 h-7 w-32' />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className='grid grid-cols-1 divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
                <OrgStat
                  label={t('Current Balance')}
                  value={formatQuota(totalBalance)}
                  description={t('Sum of your org wallets in view')}
                />
                <OrgStat
                  label={t('Wallets')}
                  value={String(filtered.length)}
                  description={t('Workspace-scoped balances')}
                />
                <OrgStat
                  label={t('Customer')}
                  value={ctx?.customer?.name ?? '—'}
                  description={t('Organization')}
                />
              </div>

              <div className='rounded-lg border'>
                <div className='text-muted-foreground border-b px-4 py-2 text-xs font-medium tracking-wider uppercase'>
                  {t('My organization wallets')}
                </div>
                {filtered.length === 0 ? (
                  <p className='text-muted-foreground p-4 text-sm'>
                    {t(
                      'No organization wallet yet. Ask a customer admin to allocate quota.'
                    )}
                  </p>
                ) : (
                  <ul className='divide-y'>
                    {filtered.map((w) => (
                      <OrgWalletRow
                        key={w.id || `${w.workspace_id}`}
                        wallet={w}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function OrgStat({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className='min-w-0 px-4 py-3 sm:py-4'>
      <div className='flex items-center gap-2'>
        <IconBadge tone='success' size='stat'>
          <WalletCards />
        </IconBadge>
        <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase sm:text-xs'>
          {label}
        </div>
      </div>
      <div className='text-foreground mt-2 font-mono text-sm font-bold tracking-tight break-all tabular-nums sm:text-xl'>
        {value}
      </div>
      <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
        {description}
      </div>
    </div>
  )
}

function OrgWalletRow({ wallet }: { wallet: OrgWallet }) {
  const { t } = useTranslation()
  const title =
    [wallet.customer_name, wallet.workspace_name].filter(Boolean).join(' · ') ||
    `${t('Workspace')} #${wallet.workspace_id}`
  return (
    <li className='flex items-center justify-between gap-3 px-4 py-3'>
      <div className='min-w-0'>
        <div className='truncate text-sm font-medium'>{title}</div>
        <div className='text-muted-foreground text-xs'>
          {t('Workspace')} ID {wallet.workspace_id}
        </div>
      </div>
      <div className='font-mono text-sm font-semibold tabular-nums'>
        {formatQuota(wallet.balance)}
      </div>
    </li>
  )
}
