/*
Copyright (C) 2023-2026 QuantumNous
*/
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import type { OrgWalletLedgerEntry } from '../api'
import { useOrgWalletLedger } from '../hooks/use-org-wallet-ledger'

interface OrgWalletLedgerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: number
  workspaceId?: number
}

function getActionConfig(action: string) {
  switch (action) {
    case 'org_wallet.credit':
      return { label: 'Wallet allocation', variant: 'success' as const }
    case 'org_wallet.debit':
      return { label: 'Wallet revocation', variant: 'warning' as const }
    case 'org_wallet.return':
      return { label: 'Returned to workspace', variant: 'info' as const }
    default:
      return { label: action, variant: 'neutral' as const }
  }
}

export function OrgWalletLedgerDialog({
  open,
  onOpenChange,
  customerId = 0,
  workspaceId = 0,
}: OrgWalletLedgerDialogProps) {
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    loading,
    handlePageChange,
    handlePageSizeChange,
  } = useOrgWalletLedger({
    customerId,
    workspaceId,
    enabled: open,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Billing History')}
      description={t(
        'View your organization wallet allocation and revocation records'
      )}
      contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'
      contentHeight='auto'
      bodyClassName='space-y-3'
    >
      <div className='min-h-0 space-y-3'>
        <div className='flex items-center justify-end'>
          <Select
            items={[
              { value: '10', label: t('10 / page') },
              { value: '20', label: t('20 / page') },
              { value: '50', label: t('50 / page') },
              { value: '100', label: t('100 / page') },
            ]}
            value={pageSize.toString()}
            onValueChange={(value) =>
              value !== null && handlePageSizeChange(parseInt(value))
            }
          >
            <SelectTrigger className='h-9 w-[92px] sm:w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='10'>{t('10 / page')}</SelectItem>
                <SelectItem value='20'>{t('20 / page')}</SelectItem>
                <SelectItem value='50'>{t('50 / page')}</SelectItem>
                <SelectItem value='100'>{t('100 / page')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='max-h-[min(54vh,520px)] overflow-y-auto pr-1'>
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='rounded-lg border p-3 sm:p-4'>
                  <Skeleton className='h-4 w-48' />
                  <Skeleton className='mt-3 h-3 w-full' />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center py-10 text-center'>
              <p className='text-sm font-medium'>
                {t('No billing records found')}
              </p>
              <p className='mt-1 text-xs'>
                {t('Your transaction history will appear here')}
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {records.map((record) => (
                <LedgerRecord key={record.id} record={record} t={t} />
              ))}
            </div>
          )}
        </div>

        {!loading && records.length > 0 ? (
          <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-muted-foreground text-xs sm:text-sm'>
              {t('Showing')} {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)} {t('of')} {total}
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className='h-8 w-8 p-0'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                <span className='font-medium'>{page}</span>
                <span>/</span>
                <span>{totalPages}</span>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className='h-8 w-8 p-0'
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function LedgerRecord({
  record,
  t,
}: {
  record: OrgWalletLedgerEntry
  t: (key: string) => string
}) {
  const actionConfig = getActionConfig(record.action)
  const workspaceLabel =
    record.workspace_name ||
    (record.workspace_id > 0
      ? `${t('Workspace')} #${record.workspace_id}`
      : '—')

  return (
    <div className='rounded-lg border p-3 sm:p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 space-y-1'>
          <div className='truncate text-sm font-medium'>{workspaceLabel}</div>
          <div className='text-muted-foreground text-xs'>
            {formatTimestampToDate(record.created_at)}
          </div>
        </div>
        <StatusBadge
          label={t(actionConfig.label)}
          variant={actionConfig.variant}
          showDot
          copyable={false}
        />
      </div>
      <div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4'>
        <div className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>{t('Amount')}</Label>
          <div className='text-sm font-semibold'>
            {formatQuota(record.amount)}
          </div>
        </div>
        <div className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>
            {t('Workspace')}
          </Label>
          <div className='truncate text-sm font-medium'>{workspaceLabel}</div>
        </div>
        {record.operator_id > 0 ? (
          <div className='space-y-1'>
            <Label className='text-muted-foreground text-xs'>
              {t('Operator ID')}
            </Label>
            <div className='text-sm font-medium'>{record.operator_id}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
