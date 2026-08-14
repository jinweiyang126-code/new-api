/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { resolveCurrentWorkspace } from '../lib/resolve-current-workspace'
import type { SelfCustomerContext } from '../types'

type Props = {
  ctx: SelfCustomerContext | null | undefined
}

export function WorkspaceContextBanner({ ctx }: Props) {
  const { t } = useTranslation()
  if (!ctx?.customer) return null

  const { isPersonal, currentWorkspace, currentWorkspaceId } =
    resolveCurrentWorkspace(ctx)
  const label = isPersonal
    ? t('Personal')
    : (currentWorkspace?.name ?? `#${currentWorkspaceId}`)

  return (
    <div className='bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm'>
      {t('Current context')}:{' '}
      <span className='text-foreground font-medium'>{label}</span>
      <span className='ms-2 text-xs'>
        ({t('Affects org defaults and new token scope')})
      </span>
    </div>
  )
}
