/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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

import {
  createUpstreamCredential,
  updateUpstreamCredential,
} from '../api'
import type { UpstreamCredential } from '../types'
import { useUpstream } from './upstream-provider'

const schema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  key: z.string().optional(),
  base_url: z.string().optional(),
  models: z.string().optional(),
  priority: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: UpstreamCredential | null
}

export function UpstreamMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const { t } = useTranslation()
  const { customerId, triggerRefresh } = useUpstream()
  const isUpdate = Boolean(currentRow)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'openai',
      key: '',
      base_url: '',
      models: '',
      priority: '0',
    },
  })

  useEffect(() => {
    if (!open) return
    if (currentRow) {
      form.reset({
        name: currentRow.name,
        type: currentRow.type || 'openai',
        key: '',
        base_url: currentRow.base_url || '',
        models: currentRow.models || '',
        priority: String(currentRow.priority ?? 0),
      })
      return
    }
    form.reset({
      name: '',
      type: 'openai',
      key: '',
      base_url: '',
      models: '',
      priority: '0',
    })
  }, [open, currentRow, form])

  const onSubmit = async (values: FormValues) => {
    const name = values.name.trim()
    const type = values.type.trim() || 'openai'
    const key = values.key?.trim() || ''
    const priority = Number.parseInt(values.priority || '0', 10) || 0

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
        priority,
        ...(key ? { key } : {}),
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to update credential'))
        return
      }
      toast.success(key ? t('Credential rotated') : t('Credential updated'))
    } else {
      const res = await createUpstreamCredential(customerId, {
        name,
        type,
        key,
        base_url: values.base_url?.trim() || undefined,
        models: values.models?.trim() || undefined,
        priority,
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to create credential'))
        return
      }
      toast.success(t('Credential created'))
    }

    form.reset()
    onOpenChange(false)
    triggerRefresh()
  }

  return (
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
              ? t('Update credential settings. Leave API Key blank to keep the current key.')
              : t('Add a customer-owned upstream credential for BYOK routing.')}
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
                    <Input {...field} placeholder='openai' />
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
                  <FormLabel>{t('Models')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('optional, comma-separated')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Priority')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' />
                  </FormControl>
                  <FormDescription>
                    {t('Higher priority is preferred when selecting upstream.')}
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
  )
}
