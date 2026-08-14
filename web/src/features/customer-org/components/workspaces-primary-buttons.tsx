/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useWorkspaces } from './workspaces-provider'

export function WorkspacesPrimaryButtons() {
  const { t } = useTranslation()
  const { isAdmin, setOpen, setCurrentRow } = useWorkspaces()
  if (!isAdmin) return null

  return (
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
  )
}
