/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'

import { topupCustomer } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  currentQuota: number
  onSuccess: () => void
}

export function CustomerTopupDialog({
  open,
  onOpenChange,
  customerId,
  currentQuota,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const currencyLabel = getCurrencyLabel()
  const dollars = parseFloat(amount) || 0
  const quotaValue = parseQuotaFromDollars(Math.abs(dollars))

  const handleConfirm = async () => {
    if (quotaValue <= 0) return
    setLoading(true)
    try {
      const res = await topupCustomer(customerId, quotaValue)
      if (!res.success) {
        toast.error(res.message || t('Failed to top up customer'))
        return
      }
      toast.success(t('Customer topped up'))
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
      title={t('Top Up Customer')}
      description={`${t('Current quota')}: ${formatQuota(currentQuota)}`}
      contentHeight='auto'
      bodyClassName='space-y-3'
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={loading || quotaValue <= 0}
            onClick={() => void handleConfirm()}
          >
            {t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
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
          {t('Will add')}: {formatQuota(quotaValue)}
        </p>
      </div>
    </Dialog>
  )
}
