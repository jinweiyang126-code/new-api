/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Building2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { useWorkspaces } from './workspaces-provider'

type Props = {
  onCreateOrganization?: () => void
}

export function WorkspacesPrimaryButtons({ onCreateOrganization }: Props) {
  const { t } = useTranslation()
  const { isAdmin, setOpen, setCurrentRow } = useWorkspaces()
  const { status } = useStatus()
  const selfRegisterEnabled = Boolean(
    status?.customer_self_register_enabled ??
      status?.data?.customer_self_register_enabled
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {selfRegisterEnabled && onCreateOrganization ? (
        <Button size='sm' variant='outline' onClick={onCreateOrganization}>
          <Building2 className='h-4 w-4' />
          {t('Create organization')}
        </Button>
      ) : null}
      {isAdmin ? (
        <Button
          size='sm'
          onClick={() => {
            setCurrentRow(null)
            setOpen('create')
          }}
        >
          <Plus className='h-4 w-4' />
          {t('Create Workspace')}
        </Button>
      ) : null}
    </div>
  )
}
