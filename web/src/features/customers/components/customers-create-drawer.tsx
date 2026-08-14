/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'

import { createCustomer } from '../api'
import { useCustomers } from './customers-provider'
import { OwnerUserPicker } from './owner-user-picker'

type FormValues = {
  name: string
  slug?: string
  remark?: string
  owner_user_id: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomersCreateDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const { triggerRefresh, setCurrentRow, setOpen } = useCustomers()
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('Name is required')),
        slug: z.string().optional(),
        remark: z.string().optional(),
        owner_user_id: z
          .number()
          .int()
          .positive(t('Please select an owner')),
      }),
    [t]
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      remark: '',
      owner_user_id: 0,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const res = await createCustomer({
      name: values.name.trim(),
      slug: values.slug?.trim() || undefined,
      remark: values.remark?.trim() || undefined,
      owner_user_id: values.owner_user_id,
    })
    if (!res.success || !res.data) {
      toast.error(
        res.message ? t(res.message) : t('Failed to create customer')
      )
      return
    }
    toast.success(t('Customer created'))
    form.reset()
    onOpenChange(false)
    triggerRefresh()
    setCurrentRow(res.data.customer)
    setOpen('update')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName()}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Create Customer')}</SheetTitle>
          <SheetDescription>
            {t('Create a billing customer with a default workspace.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
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
            <FormField
              control={form.control}
              name='owner_user_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Owner')}</FormLabel>
                  <FormControl>
                    <OwnerUserPicker
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='remark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Remark')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
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
                {t('Create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
