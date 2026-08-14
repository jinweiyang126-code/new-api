/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useMembers } from './members-provider'

export function MembersPrimaryButtons() {
  const { t } = useTranslation()
  const { isAdmin, setOpen, setCurrentInvitation } = useMembers()
  if (!isAdmin) return null

  return (
    <div className='flex gap-2'>
      <Button
        size='sm'
        onClick={() => {
          setCurrentInvitation(null)
          setOpen('invite')
        }}
      >
        <Plus className='h-4 w-4' />
        {t('Invite member')}
      </Button>
    </div>
  )
}
