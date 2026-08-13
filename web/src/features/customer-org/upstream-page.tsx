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

import {
  createUpstreamCredential,
  deleteUpstreamCredential,
  getUpstreamCredentials,
  testUpstreamCredential,
  updateUpstreamCredential,
} from './api'
import { useCustomerContext } from './hooks/use-customer-context'
import type { UpstreamCredential } from './types'

export function UpstreamPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const byokEnabled = Boolean(ctx?.customer?.byok_enabled)

  const [name, setName] = useState('')
  const [type, setType] = useState('openai')
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState('')
  const [rotateId, setRotateId] = useState<number | null>(null)
  const [rotateKey, setRotateKey] = useState('')

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['upstream-credentials', customerId],
    enabled: customerId > 0 && byokEnabled,
    queryFn: async () => {
      const res = await getUpstreamCredentials(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await createUpstreamCredential(customerId, {
        name: name.trim(),
        type: type.trim() || 'openai',
        key: key.trim(),
        base_url: baseUrl.trim() || undefined,
        models: models.trim() || undefined,
      })
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Credential created'))
      setName('')
      setKey('')
      setBaseUrl('')
      setModels('')
      void queryClient.invalidateQueries({
        queryKey: ['upstream-credentials'],
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rotateMut = useMutation({
    mutationFn: async () => {
      if (!rotateId) throw new Error('missing id')
      const res = await updateUpstreamCredential(customerId, rotateId, {
        key: rotateKey.trim(),
      })
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Credential rotated'))
      setRotateId(null)
      setRotateKey('')
      void queryClient.invalidateQueries({
        queryKey: ['upstream-credentials'],
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await deleteUpstreamCredential(customerId, id)
      if (!res.success) throw new Error(res.message)
    },
    onSuccess: () => {
      toast.success(t('Credential deleted'))
      void queryClient.invalidateQueries({
        queryKey: ['upstream-credentials'],
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const testMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await testUpstreamCredential(customerId, id)
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    onSuccess: (data) => {
      toast.success(data?.message || t('Credential test passed'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (ctxLoading) {
    return <div className='p-6 text-sm text-muted-foreground'>{t('Loading...')}</div>
  }
  if (!ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('You are not a member of any customer.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  if (!ctx.is_admin) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('Only customer admins can manage BYOK credentials.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  if (!byokEnabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('BYOK is not enabled for this customer. Ask a platform admin to enable it.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <section className='max-w-xl space-y-3'>
            <h3 className='text-sm font-semibold'>{t('Add credential')}</h3>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1'>
                <Label>{t('Name')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>{t('Type')}</Label>
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder='openai'
                />
              </div>
              <div className='space-y-1 sm:col-span-2'>
                <Label>{t('API Key')}</Label>
                <Input
                  type='password'
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete='off'
                />
              </div>
              <div className='space-y-1 sm:col-span-2'>
                <Label>{t('Base URL')}</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder='optional'
                />
              </div>
              <div className='space-y-1 sm:col-span-2'>
                <Label>{t('Models')}</Label>
                <Input
                  value={models}
                  onChange={(e) => setModels(e.target.value)}
                  placeholder='optional, comma-separated'
                />
              </div>
            </div>
            <Button
              disabled={
                !name.trim() || !key.trim() || createMut.isPending
              }
              onClick={() => createMut.mutate()}
            >
              {t('Add')}
            </Button>
          </section>

          <section className='space-y-3'>
            <h3 className='text-sm font-semibold'>{t('Credentials')}</h3>
            {isLoading ? (
              <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
            ) : credentials.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('No credentials')}
              </p>
            ) : (
              credentials.map((cred: UpstreamCredential) => (
                <div
                  key={cred.id}
                  className='space-y-2 rounded-md border px-4 py-3 text-sm'
                >
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                      <div className='font-medium'>{cred.name}</div>
                      <div className='text-muted-foreground text-xs'>
                        {cred.type} · hint …{cred.key_hint}
                        {cred.base_url ? ` · ${cred.base_url}` : ''}
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={testMut.isPending}
                        onClick={() => testMut.mutate(cred.id)}
                      >
                        {t('Test')}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          setRotateId(cred.id)
                          setRotateKey('')
                        }}
                      >
                        {t('Rotate')}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={deleteMut.isPending}
                        onClick={() => deleteMut.mutate(cred.id)}
                      >
                        {t('Delete')}
                      </Button>
                    </div>
                  </div>
                  {rotateId === cred.id ? (
                    <div className='flex flex-wrap items-end gap-2'>
                      <div className='min-w-64 flex-1 space-y-1'>
                        <Label>{t('New API Key')}</Label>
                        <Input
                          type='password'
                          value={rotateKey}
                          onChange={(e) => setRotateKey(e.target.value)}
                          autoComplete='off'
                        />
                      </div>
                      <Button
                        size='sm'
                        disabled={!rotateKey.trim() || rotateMut.isPending}
                        onClick={() => rotateMut.mutate()}
                      >
                        {t('Save')}
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setRotateId(null)}
                      >
                        {t('Cancel')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
