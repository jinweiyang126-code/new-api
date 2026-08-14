/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { Server, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  CHANNEL_TYPE_OPTIONS,
  MODEL_FETCHABLE_TYPES,
} from '@/features/channels/constants'
import { FetchModelsDialog } from '@/features/channels/components/dialogs/fetch-models-dialog'
import {
  formatModelsArray,
  getChannelTypeIcon,
  parseModelsString,
} from '@/features/channels/lib'

import {
  createUpstreamCredential,
  fetchUpstreamCredentialModels,
  getUpstreamCredentials,
  reorderUpstreamCredentials,
  updateUpstreamCredential,
} from '../api'
import { apiErrorMessage } from '../lib/api-message'
import type { UpstreamCredential } from '../types'
import { useUpstream } from './upstream-provider'

type FormValues = {
  name: string
  type: string
  key?: string
  base_url?: string
  models?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: UpstreamCredential | null
}

function CredentialTypeLogo({
  type,
  size = 16,
  className,
}: {
  type: number
  size?: number
  className?: string
}) {
  const isKnown = CHANNEL_TYPE_OPTIONS.some((option) => option.value === type)
  if (!isKnown) {
    return (
      <Server
        className={cn('text-muted-foreground shrink-0', className)}
        style={{ width: size, height: size }}
        aria-hidden='true'
      />
    )
  }
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      {getLobeIcon(`${getChannelTypeIcon(type)}.Color`, size)}
    </span>
  )
}

/** Normalize stored BYOK type (alias or numeric) to Combobox value. */
function credentialTypeToSelectValue(type: string | undefined): string {
  const raw = (type || '').trim()
  if (!raw) return '1'
  const asNum = Number.parseInt(raw, 10)
  if (!Number.isNaN(asNum) && asNum > 0) {
    return String(asNum)
  }
  const byLabel = CHANNEL_TYPE_OPTIONS.find(
    (option) => option.label.toLowerCase() === raw.toLowerCase()
  )
  if (byLabel) return String(byLabel.value)

  const aliases: Record<string, number> = {
    openai: 1,
    azure: 3,
    anthropic: 14,
    claude: 14,
    gemini: 24,
    google: 24,
    custom: 8,
  }
  const mapped = aliases[raw.toLowerCase()]
  return mapped ? String(mapped) : '1'
}

export function UpstreamMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const { t } = useTranslation()
  const { customerId, triggerRefresh } = useUpstream()
  const isUpdate = Boolean(currentRow)
  const [fetchModelsOpen, setFetchModelsOpen] = useState(false)
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('Name is required')),
        type: z.string().min(1, t('Please select a type')),
        key: z.string().optional(),
        base_url: z.string().optional(),
        models: z.string().optional(),
      }),
    [t]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: '1',
      key: '',
      base_url: '',
      models: '',
    },
  })

  const typeValue = useWatch({ control: form.control, name: 'type' })
  const typeId = Number.parseInt(typeValue || '1', 10) || 1
  const canFetchModels = MODEL_FETCHABLE_TYPES.has(typeId)

  const typeOptions = useMemo(
    () =>
      CHANNEL_TYPE_OPTIONS.map((option) => ({
        value: String(option.value),
        label: t(option.label),
        icon: <CredentialTypeLogo type={option.value} size={16} />,
      })),
    [t]
  )

  useEffect(() => {
    if (!open) return
    if (currentRow) {
      form.reset({
        name: currentRow.name,
        type: credentialTypeToSelectValue(currentRow.type),
        key: '',
        base_url: currentRow.base_url || '',
        models: currentRow.models || '',
      })
      return
    }
    form.reset({
      name: '',
      type: '1',
      key: '',
      base_url: '',
      models: '',
    })
  }, [open, currentRow, form])

  const onSubmit = async (values: FormValues) => {
    const name = values.name.trim()
    const type = values.type.trim() || '1'
    const key = values.key?.trim() || ''

    if (!isUpdate && !key) {
      toast.error(t('API Key is required'))
      return
    }

    if (isUpdate && currentRow) {
      const res = await updateUpstreamCredential(customerId, currentRow.id, {
        name,
        type,
        base_url: values.base_url?.trim() || '',
        models: values.models?.trim() || '',
        ...(key ? { key } : {}),
      })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to update credential'))
        return
      }
      toast.success(key ? t('Credential rotated') : t('Credential updated'))
    } else {
      const listRes = await getUpstreamCredentials(customerId)
      const existingIds = listRes.success
        ? (listRes.data ?? []).map((row) => row.id)
        : []
      const res = await createUpstreamCredential(customerId, {
        name,
        type,
        key,
        base_url: values.base_url?.trim() || undefined,
        models: values.models?.trim() || undefined,
        priority: 0,
      })
      if (!res.success || !res.data) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to create credential'))
        return
      }
      const orderedIds = [...existingIds, res.data.id]
      if (orderedIds.length > 0) {
        await reorderUpstreamCredentials(customerId, orderedIds)
      }
      toast.success(t('Credential created'))
    }

    form.reset()
    onOpenChange(false)
    triggerRefresh()
  }

  const handleOpenFetchModels = () => {
    if (!canFetchModels) {
      toast.error(t('This channel type does not support fetching models'))
      return
    }
    const key = form.getValues('key')?.trim() || ''
    if (!isUpdate && !key) {
      toast.error(t('Please enter API key first'))
      return
    }
    if (isUpdate && !key && !currentRow?.id) {
      toast.error(t('Please enter API key first'))
      return
    }
    setFetchModelsOpen(true)
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) form.reset()
          onOpenChange(next)
        }}
      >
        <SheetContent className={sideDrawerContentClassName('sm:max-w-[480px]')}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>
              {isUpdate ? t('Edit Credential') : t('Add Credential')}
            </SheetTitle>
            <SheetDescription>
              {isUpdate
                ? t(
                    'Update credential settings. Leave API Key blank to keep the current key.'
                  )
                : t(
                    'Add a customer-owned upstream credential for BYOK routing.'
                  )}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              id='upstream-credential-form'
              className={sideDrawerFormClassName()}
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Type')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={typeOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('Select type')}
                        emptyText={t('No types found')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isUpdate ? t('New API Key') : t('API Key')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='password'
                        autoComplete='off'
                        placeholder={
                          isUpdate
                            ? t('optional, leave blank to keep')
                            : undefined
                        }
                      />
                    </FormControl>
                    {isUpdate ? (
                      <FormDescription>
                        {t('Current hint')}: …{currentRow?.key_hint || '****'}
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='base_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Base URL')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('optional')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='models'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-center justify-between gap-2'>
                      <FormLabel>{t('Models')}</FormLabel>
                      {canFetchModels ? (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleOpenFetchModels}
                        >
                          <Sparkles className='mr-2 h-4 w-4' aria-hidden='true' />
                          {t('Fetch from Upstream')}
                        </Button>
                      ) : null}
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('optional, comma-separated')}
                      />
                    </FormControl>
                    <FormDescription>
                      {canFetchModels
                        ? t(
                            'Fill Type and API Key, then fetch models from upstream.'
                          )
                        : t(
                            'This type does not support fetching models; enter them manually.'
                          )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SheetFooter className={sideDrawerFooterClassName()}>
                <SheetClose render={<Button type='button' variant='outline' />}>
                  {t('Cancel')}
                </SheetClose>
                <Button type='submit' disabled={form.formState.isSubmitting}>
                  {isUpdate ? t('Save') : t('Create')}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <FetchModelsDialog
        open={fetchModelsOpen}
        onOpenChange={setFetchModelsOpen}
        existingModelsOverride={parseModelsString(
          form.getValues('models') || ''
        )}
        channelName={form.getValues('name')?.trim() || undefined}
        onModelsSelected={(models) => {
          form.setValue('models', formatModelsArray(models), {
            shouldDirty: true,
          })
        }}
        customFetcher={async () => {
          const values = form.getValues()
          const res = await fetchUpstreamCredentialModels(customerId, {
            type: values.type.trim() || '1',
            key: values.key?.trim() || undefined,
            base_url: values.base_url?.trim() || undefined,
            credential_id: isUpdate ? currentRow?.id : undefined,
          })
          if (!res.success) {
            throw new Error(apiErrorMessage(t, res.message, 'Failed to fetch models'))
          }
          return Array.isArray(res.data) ? res.data : []
        }}
      />
    </>
  )
}
