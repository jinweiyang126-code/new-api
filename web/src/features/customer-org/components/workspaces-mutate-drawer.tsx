/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
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
import { getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import { createWorkspace, updateWorkspace } from '../api'
import { useCustomerContext } from '../hooks/use-customer-context'
import { apiErrorMessage } from '../lib/api-message'
import type { Workspace } from '../types'
import { useWorkspaces } from './workspaces-provider'

type FormValues = {
  name: string
  slug?: string
  quotaLimitDollars?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Workspace | null
}

export function WorkspacesMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { triggerRefresh } = useWorkspaces()
  const { data: ctx } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const isUpdate = Boolean(currentRow)
  const isAdmin = Boolean(ctx?.is_admin)
  const currencyLabel = getCurrencyLabel()
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('Workspace name is required')),
        slug: z.string().optional(),
        quotaLimitDollars: z.string().optional(),
      }),
    [t]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', quotaLimitDollars: '' },
  })

  useEffect(() => {
    if (!open) return
    if (currentRow) {
      const dollars = quotaUnitsToDollars(currentRow.quota_limit ?? 0)
      form.reset({
        name: currentRow.name,
        slug: currentRow.slug,
        quotaLimitDollars: dollars > 0 ? String(dollars) : '',
      })
      return
    }
    form.reset({ name: '', slug: '', quotaLimitDollars: '' })
  }, [open, currentRow, form])

  const onSubmit = async (values: FormValues) => {
    const trimmed = values.name.trim()
    if (!trimmed) {
      toast.error(t('Workspace name is required'))
      return
    }

    let quotaLimit: number | undefined
    if (
      isAdmin &&
      values.quotaLimitDollars != null &&
      values.quotaLimitDollars !== ''
    ) {
      const dollars = parseFloat(values.quotaLimitDollars)
      if (!Number.isFinite(dollars) || dollars < 0) {
        toast.error(t('Invalid quota limit'))
        return
      }
      quotaLimit = parseQuotaFromDollars(dollars)
      const occupied = currentRow?.occupied_quota ?? 0
      if (quotaLimit < occupied) {
        toast.error(
          t('Quota limit cannot be below occupied amount ({{min}})', {
            min: formatQuota(occupied),
          })
        )
        return
      }
    }

    if (isUpdate && currentRow) {
      const res = await updateWorkspace(currentRow.id, {
        name: trimmed,
        ...(quotaLimit !== undefined ? { quota_limit: quotaLimit } : {}),
      })
      if (!res.success) {
        toast.error(
          apiErrorMessage(t, res.message, 'Failed to update workspace')
        )
        return
      }
      toast.success(t('Workspace updated'))
    } else {
      const res = await createWorkspace(customerId, {
        name: trimmed,
        slug: values.slug?.trim() || undefined,
      })
      if (!res.success) {
        toast.error(
          apiErrorMessage(t, res.message, 'Failed to create workspace')
        )
        return
      }
      if (quotaLimit !== undefined && res.data?.id) {
        const limitRes = await updateWorkspace(res.data.id, {
          quota_limit: quotaLimit,
        })
        if (!limitRes.success) {
          toast.error(
            apiErrorMessage(
              t,
              limitRes.message,
              'Workspace created but failed to set quota limit'
            )
          )
        } else {
          toast.success(t('Workspace created'))
        }
      } else {
        toast.success(t('Workspace created'))
      }
    }

    form.reset()
    onOpenChange(false)
    triggerRefresh()
    void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
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
            {isUpdate ? t('Edit Workspace') : t('Create Workspace')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update workspace name and quota limit.')
              : t('Create a workspace to isolate tokens and quota.')}
            {isUpdate && currentRow?.id != null ? (
              <span className='text-muted-foreground mt-1 block font-mono text-xs tabular-nums'>
                {t('ID')}: {currentRow.id}
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='workspace-form'
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
                    <Input {...field} placeholder={t('Workspace name')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isUpdate ? (
              <FormField
                control={form.control}
                name='slug'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Slug')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('optional, auto-generated from name')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {isAdmin ? (
              <FormField
                control={form.control}
                name='quotaLimitDollars'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Quota limit')} ({currencyLabel})
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        min={0}
                        step='0.01'
                        placeholder='0'
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Cannot be below occupied allocation. Customer remaining limit applies.'
                      )}
                      {currentRow ? (
                        <span className='mt-1 block'>
                          {t('Occupied')}:{' '}
                          {formatQuota(currentRow.occupied_quota ?? 0)} ·{' '}
                          {t('Allocatable')}:{' '}
                          {formatQuota(currentRow.allocatable_quota ?? 0)}
                        </span>
                      ) : null}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button type='button' variant='outline' />}>
            {t('Cancel')}
          </SheetClose>
          <Button type='submit' form='workspace-form'>
            {isUpdate ? t('Save') : t('Create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
