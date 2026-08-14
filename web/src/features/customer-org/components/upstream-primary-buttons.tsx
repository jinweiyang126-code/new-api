/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useUpstream } from './upstream-provider'

export function UpstreamPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUpstream()

  return (
    <div className='flex gap-2'>
      <Button
        size='sm'
        onClick={() => {
          setCurrentRow(null)
          setOpen('create')
        }}
      >
        <Plus className='h-4 w-4' />
        {t('Add Credential')}
      </Button>
    </div>
  )
}
