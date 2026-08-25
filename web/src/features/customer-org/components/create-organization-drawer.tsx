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

import { createSelfCustomer } from '../api'
import {
  SELF_CUSTOMER_QUERY_KEY,
  useSetCurrentCustomer,
} from '../hooks/use-customer-context'
import { apiErrorMessage } from '../lib/api-message'

type FormValues = {
  organization_name: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrganizationDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const setCurrentCustomer = useSetCurrentCustomer()

  const schema = useMemo(
    () =>
      z.object({
        organization_name: z
          .string()
          .trim()
          .min(1, t('Organization name is required')),
      }),
    [t]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { organization_name: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({ organization_name: '' })
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    const res = await createSelfCustomer({
      organization_name: values.organization_name.trim(),
    })
    if (!res.success || !res.data) {
      toast.error(
        apiErrorMessage(t, res.message, 'Failed to create organization')
      )
      return
    }
    toast.success(t('Organization created'))
    onOpenChange(false)
    await queryClient.invalidateQueries({ queryKey: SELF_CUSTOMER_QUERY_KEY })
    if (res.data.customer_id > 0) {
      setCurrentCustomer.mutate(res.data.customer_id)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[480px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Create organization')}</SheetTitle>
          <SheetDescription>
            {t(
              'Create another organization. You will become its owner. Existing memberships are kept.'
            )}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            className={sideDrawerFormClassName()}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name='organization_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Organization name')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('Organization name')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className={sideDrawerFooterClassName()}>
              <SheetClose render={<Button type='button' variant='outline' />}>
                {t('Cancel')}
              </SheetClose>
              <Button type='submit' disabled={form.formState.isSubmitting}>
                {t('Create organization')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
