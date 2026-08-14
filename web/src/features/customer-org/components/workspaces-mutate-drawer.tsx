/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
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

import { createWorkspace } from '../api'
import { useCustomerContext } from '../hooks/use-customer-context'
import { useWorkspaces } from './workspaces-provider'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspacesMutateDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { triggerRefresh } = useWorkspaces()
  const { data: ctx } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  })

  const onSubmit = async (values: FormValues) => {
    const trimmed = values.name.trim()
    if (!trimmed) {
      toast.error(t('Workspace name is required'))
      return
    }
    const res = await createWorkspace(customerId, {
      name: trimmed,
      slug: values.slug?.trim() || undefined,
    })
    if (!res.success) {
      toast.error(res.message || t('Failed to create workspace'))
      return
    }
    toast.success(t('Workspace created'))
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
          <SheetTitle>{t('Create Workspace')}</SheetTitle>
          <SheetDescription>
            {t('Create a workspace to isolate tokens and quota.')}
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
