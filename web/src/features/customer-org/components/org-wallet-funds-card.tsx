/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Receipt, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TitledCard } from '@/components/ui/titled-card'

interface OrgWalletFundsCardProps {
  onOpenLedger?: () => void
}

export function OrgWalletFundsCard({ onOpenLedger }: OrgWalletFundsCardProps) {
  const { t } = useTranslation()

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t(
        'Organization wallet balances are allocated by customer admins. This page is read-only.'
      )}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      action={
        onOpenLedger ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenLedger}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4 w-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-4'
    >
      <Alert>
        <AlertDescription>
          {t('Please contact your organization administrator')}
        </AlertDescription>
      </Alert>
    </TitledCard>
  )
}
