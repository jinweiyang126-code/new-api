/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { FlaskConical, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { testUpstreamCredential } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { CREDENTIAL_STATUS } from '../constants'
import type { UpstreamCredential } from '../types'
import { useUpstream } from './upstream-provider'

export function UpstreamRowActions({
  row,
}: {
  row: Row<UpstreamCredential>
}) {
  const { t } = useTranslation()
  const { customerId, setOpen, setCurrentRow } = useUpstream()
  const cred = row.original
  const enabled = cred.status === CREDENTIAL_STATUS.ENABLED

  const openWith = (type: 'update' | 'delete' | 'enable' | 'disable') => {
    setCurrentRow(cred)
    setOpen(type)
  }

  const handleTest = async () => {
    try {
      const res = await testUpstreamCredential(customerId, cred.id)
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Credential test failed'))
        return
      }
      // Backend may return an English diagnostic string; always localize for UI.
      toast.success(t('Credential test passed'))
    } catch (e) {
      toast.error(apiErrorMessage(t, e instanceof Error ? e.message : '', 'Credential test failed'))
    }
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => openWith('update')}
              aria-label={t('Edit')}
            />
          }
        >
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>

      <DataTableRowActionMenu ariaLabel={t('Open menu')} contentClassName='w-48'>
        <DropdownMenuItem onClick={() => void handleTest()}>
          {t('Test')}
          <DropdownMenuShortcut>
            <FlaskConical size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openWith(enabled ? 'disable' : 'enable')}
          className={
            enabled ? 'text-destructive focus:text-destructive' : undefined
          }
        >
          {enabled ? t('Disable') : t('Enable')}
          <DropdownMenuShortcut>
            {enabled ? <PowerOff size={16} /> : <Power size={16} />}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          onClick={() => openWith('delete')}
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
