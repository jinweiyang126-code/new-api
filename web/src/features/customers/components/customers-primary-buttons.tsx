/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useCustomers } from './customers-provider'

export function CustomersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useCustomers()

  return (
    <Button
      size='sm'
      onClick={() => {
        setCurrentRow(null)
        setOpen('create')
      }}
    >
      <Plus className='h-4 w-4' />
      {t('Create Customer')}
    </Button>
  )
}
