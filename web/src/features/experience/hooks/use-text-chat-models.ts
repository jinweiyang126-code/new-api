/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo } from 'react'

import { getUserGroups, getUserModels } from '@/features/playground/api'
import {
  getGroupFallback,
  getModelFallback,
} from '@/features/playground/lib'
import type { GroupOption, ModelOption } from '@/features/playground/types'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { isTextChatModel } from '@/lib/chat-models'
import { useQuery } from '@tanstack/react-query'

type Args = {
  group: string
  model: string
  onGroupChange: (group: string) => void
  onModelChange: (model: string) => void
}

export function useTextChatModels({
  group,
  model,
  onGroupChange,
  onModelChange,
}: Args) {
  const { models: pricingModels, isLoading: isPricingLoading } =
    usePricingData()

  const modelsQuery = useQuery({
    queryKey: ['experience-text-models', group],
    queryFn: () => getUserModels(group),
    enabled: group !== '',
  })

  const groupsQuery = useQuery({
    queryKey: ['experience-text-groups'],
    queryFn: getUserGroups,
  })

  const endpointByName = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of pricingModels) {
      map.set(item.model_name, item.supported_endpoint_types ?? [])
    }
    return map
  }, [pricingModels])

  const models: ModelOption[] = useMemo(() => {
    const source = modelsQuery.data ?? []
    return source.filter((option) =>
      isTextChatModel(option.value, endpointByName.get(option.value))
    )
  }, [endpointByName, modelsQuery.data])

  const groups: GroupOption[] = useMemo(
    () => groupsQuery.data ?? [],
    [groupsQuery.data]
  )

  useEffect(() => {
    const fallback = getGroupFallback(groups, group)
    if (fallback) onGroupChange(fallback)
  }, [group, groups, onGroupChange])

  useEffect(() => {
    const fallback = getModelFallback(models, model)
    if (fallback) onModelChange(fallback)
  }, [model, models, onModelChange])

  return {
    models,
    groups,
    isLoadingModels: modelsQuery.isLoading || isPricingLoading,
  }
}
