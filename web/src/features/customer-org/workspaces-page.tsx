/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatQuota } from '@/lib/format'

import {
  createWorkspace,
  getCustomerWorkspaces,
  updateWorkspace,
} from './api'
import { WORKSPACE_STATUS } from './constants'
import { useCustomerContext } from './hooks/use-customer-context'
import type { Workspace } from './types'

export function WorkspacesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const isAdmin = Boolean(ctx?.is_admin)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['customer-workspaces', customerId],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getCustomerWorkspaces(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await createWorkspace(customerId, {
        name: name.trim(),
        slug: slug.trim() || undefined,
      })
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Workspace created'))
      setName('')
      setSlug('')
      void queryClient.invalidateQueries({ queryKey: ['customer-workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number
      status: number
    }) => {
      const res = await updateWorkspace(id, { status })
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Workspace updated'))
      void queryClient.invalidateQueries({ queryKey: ['customer-workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (ctxLoading) {
    return <div className='p-6 text-sm text-muted-foreground'>{t('Loading...')}</div>
  }
  if (!ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Workspaces')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('You are not a member of any customer.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Workspaces')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
          {isAdmin ? (
            <div className='flex flex-wrap items-end gap-3'>
              <div className='space-y-1'>
                <Label>{t('Name')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>{t('Slug')}</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder='optional'
                />
              </div>
              <Button
                disabled={!name.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {t('Create Workspace')}
              </Button>
            </div>
          ) : null}

          <div className='space-y-2'>
            {isLoading ? (
              <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
            ) : workspaces.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('No workspaces')}
              </p>
            ) : (
              workspaces.map((ws: Workspace) => (
                <div
                  key={ws.id}
                  className='flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3'
                >
                  <div>
                    <div className='font-medium'>
                      {ws.name}
                      {ws.is_default ? (
                        <span className='text-muted-foreground ml-2 text-xs'>
                          ({t('default')})
                        </span>
                      ) : null}
                      {ws.status !== WORKSPACE_STATUS.ENABLED ? (
                        <span className='ml-2 text-xs text-amber-600'>
                          {t('Disabled')}
                        </span>
                      ) : null}
                    </div>
                    <div className='text-muted-foreground text-xs'>{ws.slug}</div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='text-right text-sm'>
                      <div>{formatQuota(ws.quota)}</div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Used')}: {formatQuota(ws.used_quota)}
                      </div>
                    </div>
                    {isAdmin && !ws.is_default ? (
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={toggleMut.isPending}
                        onClick={() =>
                          toggleMut.mutate({
                            id: ws.id,
                            status:
                              ws.status === WORKSPACE_STATUS.ENABLED
                                ? WORKSPACE_STATUS.DISABLED
                                : WORKSPACE_STATUS.ENABLED,
                          })
                        }
                      >
                        {ws.status === WORKSPACE_STATUS.ENABLED
                          ? t('Disable')
                          : t('Enable')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
