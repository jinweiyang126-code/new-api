/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'

import { setCustomerQuotaLimit } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  currentQuotaLimit: number
  occupiedQuota?: number
  onSuccess: () => void
}

export function CustomerTopupDialog({
  open,
  onOpenChange,
  customerId,
  currentQuotaLimit,
  occupiedQuota = 0,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const currencyLabel = getCurrencyLabel()
  const dollars = parseFloat(amount)
  const quotaValue = Number.isFinite(dollars)
    ? parseQuotaFromDollars(Math.max(0, dollars))
    : 0

  useEffect(() => {
    if (!open) return
    // Prefill with current limit in display dollars if available via format round-trip is hard;
    // leave empty and show current limit in description.
    setAmount('')
  }, [open, currentQuotaLimit])

  const handleConfirm = async () => {
    if (quotaValue < 0) return
    if (quotaValue < occupiedQuota) {
      toast.error(
        t('Quota limit cannot be below occupied amount ({{min}})', {
          min: formatQuota(occupiedQuota),
        })
      )
      return
    }
    setLoading(true)
    try {
      const res = await setCustomerQuotaLimit(customerId, quotaValue)
      if (!res.success) {
        toast.error(res.message || t('Failed to set customer quota limit'))
        return
      }
      toast.success(t('Customer quota limit updated'))
      setAmount('')
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Set Customer Quota Limit')}
      description={`${t('Current limit')}: ${formatQuota(currentQuotaLimit)} · ${t('Occupied')}: ${formatQuota(occupiedQuota)}`}
      contentHeight='auto'
      bodyClassName='space-y-3'
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={loading || !Number.isFinite(dollars) || dollars < 0}
            onClick={() => void handleConfirm()}
          >
            {t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>
          {t('Quota limit')} ({currencyLabel})
        </Label>
        <Input
          type='number'
          min={0}
          step='0.01'
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t('Enter absolute quota limit')}
        />
        <p className='text-muted-foreground text-xs'>
          {t('Will set limit to')}: {formatQuota(quotaValue)}
        </p>
      </div>
    </Dialog>
  )
}
