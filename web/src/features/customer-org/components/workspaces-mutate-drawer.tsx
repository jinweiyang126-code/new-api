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

import { createWorkspace, updateWorkspace } from '../api'
import { apiErrorMessage } from '../lib/api-message'
import type { Workspace } from '../types'
import { useCustomerContext } from '../hooks/use-customer-context'
import { useWorkspaces } from './workspaces-provider'

type FormValues = {
  name: string
  slug?: string
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
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('Workspace name is required')),
        slug: z.string().optional(),
      }),
    [t]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  })

  useEffect(() => {
    if (!open) return
    if (currentRow) {
      form.reset({ name: currentRow.name, slug: currentRow.slug })
      return
    }
    form.reset({ name: '', slug: '' })
  }, [open, currentRow, form])

  const onSubmit = async (values: FormValues) => {
    const trimmed = values.name.trim()
    if (!trimmed) {
      toast.error(t('Workspace name is required'))
      return
    }

    if (isUpdate && currentRow) {
      const res = await updateWorkspace(currentRow.id, { name: trimmed })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to update workspace'))
        return
      }
      toast.success(t('Workspace updated'))
    } else {
      const res = await createWorkspace(customerId, {
        name: trimmed,
        slug: values.slug?.trim() || undefined,
      })
      if (!res.success) {
        toast.error(apiErrorMessage(t, res.message, 'Failed to create workspace'))
        return
      }
      toast.success(t('Workspace created'))
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
              ? t('Update workspace name.')
              : t('Create a workspace to isolate tokens and quota.')}
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
            ) : (
              <FormItem>
                <FormLabel>{t('Slug')}</FormLabel>
                <Input value={currentRow?.slug ?? ''} disabled />
              </FormItem>
            )}
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
