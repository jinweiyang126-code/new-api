/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCustomerContext,
  useSetCurrentWorkspace,
} from '@/features/customer-org/hooks/use-customer-context'
import { WORKSPACE_STATUS } from '@/features/customer-org/constants'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Top-bar customer name + workspace switcher (T12).
 * Switching only updates UX preference; billing follows each token's workspace_id.
 */
export function WorkspaceContextSwitcher() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const { data: ctx, isLoading } = useCustomerContext(Boolean(user))
  const switchMut = useSetCurrentWorkspace()

  if (!user || isLoading) return null
  if (!ctx?.customer) return null

  const workspaces = (ctx.workspaces ?? []).filter(
    (w) => w.status === WORKSPACE_STATUS.ENABLED
  )
  const currentId = ctx.current_workspace_id ?? 0
  const value = currentId > 0 ? String(currentId) : 'personal'

  return (
    <div className='ms-2 hidden min-w-0 items-center gap-2 md:flex'>
      <div className='text-muted-foreground flex max-w-[10rem] items-center gap-1 truncate text-xs'>
        <Building2 className='size-3.5 shrink-0' />
        <span className='truncate' title={ctx.customer.name}>
          {ctx.customer.name}
        </span>
      </div>
      <Select
        value={value}
        disabled={switchMut.isPending}
        items={[
          { value: 'personal', label: t('Personal') },
          ...workspaces.map((ws) => ({
            value: String(ws.id),
            label: ws.name,
          })),
        ]}
        onValueChange={(v) => {
          const next = !v || v === 'personal' ? 0 : Number(v)
          if (Number.isNaN(next)) return
          switchMut.mutate(next, {
            onSuccess: () => toast.success(t('Workspace switched')),
            onError: (e: Error) =>
              toast.error(e.message || t('Failed to switch workspace')),
          })
        }}
      >
        <SelectTrigger
          size='sm'
          className='h-8 max-w-[11rem] min-w-[7.5rem] text-xs'
          aria-label={t('Current workspace')}
        >
          <SelectValue placeholder={t('Current workspace')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='personal'>{t('Personal')}</SelectItem>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={String(ws.id)}>
              {ws.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
