/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const ORG_FILTER_ALL = 'all'

type CustomerOption = {
  id: number
  name: string
}

type WorkspaceOption = {
  id: number
  name: string
}

type Props = {
  customers?: CustomerOption[]
  workspaces: WorkspaceOption[]
  customerId: string
  workspaceId: string
  onCustomerChange: (value: string) => void
  onWorkspaceChange: (value: string) => void
  showCustomerFilter?: boolean
  /** When false, customer filter acts as a switcher (no All). Default true. */
  customerIncludeAll?: boolean
  /** When false, hide the workspace selector. Default true. */
  showWorkspaceFilter?: boolean
}

/**
 * Page-level customer / workspace filters for org pages.
 * Defaults should be ORG_FILTER_ALL ("全部").
 */
export function OrgScopeFilters({
  customers = [],
  workspaces,
  customerId,
  workspaceId,
  onCustomerChange,
  onWorkspaceChange,
  showCustomerFilter = false,
  customerIncludeAll = true,
  showWorkspaceFilter = true,
}: Props) {
  const { t } = useTranslation()

  const customerItems = useMemo(() => {
    const rows = customers.map((c) => ({
      value: String(c.id),
      label: c.name,
    }))
    if (!customerIncludeAll) return rows
    return [{ value: ORG_FILTER_ALL, label: t('All') }, ...rows]
  }, [customers, customerIncludeAll, t])

  const workspaceItems = useMemo(
    () => [
      { value: ORG_FILTER_ALL, label: t('All') },
      ...workspaces.map((ws) => ({
        value: String(ws.id),
        label: ws.name,
      })),
    ],
    [t, workspaces]
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {showCustomerFilter ? (
        <Select
          value={customerId}
          items={customerItems}
          onValueChange={(value) => onCustomerChange(value ?? ORG_FILTER_ALL)}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder={t('Customer')} />
          </SelectTrigger>
          <SelectContent>
            {customerIncludeAll ? (
              <SelectItem value={ORG_FILTER_ALL}>{t('All')}</SelectItem>
            ) : null}
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {showWorkspaceFilter ? (
        <Select
          value={workspaceId}
          items={workspaceItems}
          onValueChange={(value) => onWorkspaceChange(value ?? ORG_FILTER_ALL)}
        >
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder={t('Workspace')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ORG_FILTER_ALL}>{t('All')}</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={String(ws.id)}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
