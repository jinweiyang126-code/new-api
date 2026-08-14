/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PriorityOrderList } from '@/components/priority-order-list'
import { CHANNEL_TYPES } from '@/features/channels/constants'
import { getChannelTypeLabel } from '@/features/channels/lib'

import {
  getUpstreamCredentials,
  reorderUpstreamCredentials,
} from '../api'
import { apiErrorMessage } from '../lib/api-message'
import { useUpstream } from './upstream-provider'

function formatTypeLabel(type: string, t: (key: string) => string): string {
  const raw = (type || '').trim()
  if (!raw) return '—'
  const asNum = Number.parseInt(raw, 10)
  if (!Number.isNaN(asNum) && asNum > 0) {
    const label = getChannelTypeLabel(asNum)
    return label === 'Unknown' ? raw : t(label)
  }
  const byName = Object.entries(CHANNEL_TYPES).find(
    ([, label]) => label.toLowerCase() === raw.toLowerCase()
  )
  if (byName) return t(byName[1])
  return raw
}

export function UpstreamPriorityOrder() {
  const { t } = useTranslation()
  const { customerId, refreshTrigger, triggerRefresh } = useUpstream()

  const { data: credentials = [], refetch } = useQuery({
    queryKey: ['upstream-credentials-order', customerId, refreshTrigger],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getUpstreamCredentials(customerId)
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to load credentials'))
        return []
      }
      return res.data ?? []
    },
  })

  const items = useMemo(
    () =>
      credentials.map((cred) => ({
        id: cred.id,
        label: cred.name,
        description: formatTypeLabel(cred.type, t),
      })),
    [credentials, t]
  )

  const reorder = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const res = await reorderUpstreamCredentials(customerId, orderedIds)
      if (!res.success) throw new Error(apiErrorMessage(t, res.message, 'Failed to reorder credentials'))
      return res.data
    },
    onSuccess: () => {
      void refetch()
      triggerRefresh()
    },
    onError: (err: Error) => {
      toast.error(apiErrorMessage(t, err.message, 'Failed to reorder credentials'))
      void refetch()
    },
  })

  if (credentials.length < 2) {
    return null
  }

  return (
    <div className='space-y-2 rounded-lg border p-3'>
      <div>
        <h3 className='text-sm font-medium'>{t('Preference order')}</h3>
        <p className='text-muted-foreground text-xs'>
          {t('Drag to set preference order. Higher items are tried first.')}
        </p>
      </div>
      <PriorityOrderList
        items={items}
        disabled={reorder.isPending}
        onReorder={(orderedIds) => reorder.mutate(orderedIds)}
      />
    </div>
  )
}
