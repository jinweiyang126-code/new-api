/*
Copyright (C) 2023-2026 QuantumNous
*/
import type { Row } from '@tanstack/react-table'
import { Pencil, Power, PowerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { WORKSPACE_STATUS } from '../constants'
import type { Workspace } from '../types'
import { useWorkspaces } from './workspaces-provider'

export function WorkspacesRowActions({ row }: { row: Row<Workspace> }) {
  const { t } = useTranslation()
  const { isAdmin, setOpen, setCurrentRow } = useWorkspaces()
  const ws = row.original
  const enabled = ws.status === WORKSPACE_STATUS.ENABLED

  if (!isAdmin) {
    return null
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setCurrentRow(ws)
                setOpen('update')
              }}
              aria-label={t('Edit')}
            />
          }
        >
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>

      {!ws.is_default ? (
        <DataTableRowActionMenu
          ariaLabel={t('Open menu')}
          contentClassName='w-44'
        >
          <DropdownMenuItem
            className={
              enabled ? 'text-destructive focus:text-destructive' : undefined
            }
            onClick={() => {
              setCurrentRow(ws)
              setOpen(enabled ? 'disable' : 'enable')
            }}
          >
            {enabled ? t('Disable') : t('Enable')}
            <DropdownMenuShortcut>
              {enabled ? <PowerOff size={16} /> : <Power size={16} />}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DataTableRowActionMenu>
      ) : null}
    </div>
  )
}
