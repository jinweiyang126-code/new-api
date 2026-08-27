/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { WalletStatsCard } from '@/features/wallet/components/wallet-stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatQuota } from '@/lib/format'

import { getSelfOrgWallets, type OrgWallet } from './api'
import { OrgWalletLedgerDialog } from './components/dialogs/org-wallet-ledger-dialog'
import { OrgWalletFundsCard } from './components/org-wallet-funds-card'
import { useCustomerContext } from './hooks/use-customer-context'

const FILTER_ALL = 'all'

export function OrgWalletPage() {
  const { t } = useTranslation()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const workspaces = ctx?.workspaces ?? []
  const [workspaceFilter, setWorkspaceFilter] = useState(FILTER_ALL)
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false)

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

  const workspaceFilterItems = useMemo(
    () => [
      { value: FILTER_ALL, label: t('All') },
      ...workspaces.map((ws) => ({
        value: String(ws.id),
        label: ws.name,
      })),
    ],
    [t, workspaces]
  )

  const stats = useMemo(
    () =>
      filtered.reduce(
        (acc, wallet) => ({
          quota: acc.quota + (wallet.balance ?? 0),
          used_quota: acc.used_quota + (wallet.used_quota ?? 0),
          request_count: acc.request_count + (wallet.request_count ?? 0),
        }),
        { quota: 0, used_quota: 0, request_count: 0 }
      ),
    [filtered]
  )

  const ledgerWorkspaceId =
    workspaceFilter === FILTER_ALL ? 0 : Number(workspaceFilter)

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
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard stats={stats} loading={loading} />

            <OrgWalletFundsCard
              onOpenLedger={() => setLedgerDialogOpen(true)}
            />

            {!loading ? (
              <div className='rounded-lg border'>
                <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2'>
                  <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('My organization wallets')}
                  </div>
                  <Select
                    value={workspaceFilter}
                    items={workspaceFilterItems}
                    onValueChange={(value) => {
                      if (value != null) setWorkspaceFilter(value)
                    }}
                  >
                    <SelectTrigger className='h-8 w-[180px]'>
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
                </div>
                {filtered.length === 0 ? (
                  <p className='text-muted-foreground p-4 text-sm'>
                    {t('Ask a customer admin to allocate quota.')}
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
            ) : null}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <OrgWalletLedgerDialog
        open={ledgerDialogOpen}
        onOpenChange={setLedgerDialogOpen}
        customerId={customerId}
        workspaceId={ledgerWorkspaceId}
      />
    </>
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

