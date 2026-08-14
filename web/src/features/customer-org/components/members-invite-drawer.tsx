/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { createCustomerInvitation } from '../api'
import { CUSTOMER_ROLES, WORKSPACE_ROLES } from '../constants'
import { useCustomerContext } from '../hooks/use-customer-context'
import type { Workspace } from '../types'
import { useMembers } from './members-provider'

const schema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  workspace_role: z.string().min(1),
  workspace_id: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MembersInviteDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx } = useCustomerContext()
  const {
    customerId,
    isPersonal,
    currentWorkspaceId,
    currentWorkspaceName,
    triggerRefresh,
  } = useMembers()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      role: CUSTOMER_ROLES.MEMBER,
      workspace_role: WORKSPACE_ROLES.MEMBER,
      workspace_id: 'default',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      email: '',
      role: CUSTOMER_ROLES.MEMBER,
      workspace_role: WORKSPACE_ROLES.MEMBER,
      workspace_id:
        !isPersonal && currentWorkspaceId > 0
          ? String(currentWorkspaceId)
          : 'default',
    })
  }, [open, isPersonal, currentWorkspaceId, form])

  const onSubmit = async (values: FormValues) => {
    const payload: {
      email: string
      role: string
      workspace_role: string
      workspace_id?: number
    } = {
      email: values.email.trim(),
      role: values.role,
      workspace_role: values.workspace_role,
    }
    if (values.workspace_id !== 'default') {
      payload.workspace_id = Number(values.workspace_id)
    }
    const res = await createCustomerInvitation(customerId, payload)
    if (!res.success || !res.data) {
      toast.error(res.message || t('Failed to create invitation'))
      return
    }
    const inv = res.data
    const link = `${window.location.origin}/invitations/accept?token=${encodeURIComponent(inv.token)}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // ignore
    }
    if (inv.email_sent) {
      toast.success(t('Invitation created. Email sent.'))
    } else {
      toast.success(t('Invitation created. Email not sent.'))
      if (inv.email_error) toast.message(inv.email_error)
    }
    form.reset()
    onOpenChange(false)
    triggerRefresh()
    void queryClient.invalidateQueries({ queryKey: ['customer-invitations'] })
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
          <SheetTitle>{t('Invite member')}</SheetTitle>
          <SheetDescription>
            {t('Send an invitation email and copy the accept link.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            className={sideDrawerFormClassName()}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Email')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='email'
                      placeholder={t('Invitee email')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Customer role')}</FormLabel>
                  <Select
                    value={field.value}
                    items={[
                      { value: CUSTOMER_ROLES.ADMIN, label: 'admin' },
                      { value: CUSTOMER_ROLES.MEMBER, label: 'member' },
                    ]}
                    onValueChange={(v) =>
                      field.onChange(v ?? CUSTOMER_ROLES.MEMBER)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={CUSTOMER_ROLES.ADMIN}>admin</SelectItem>
                      <SelectItem value={CUSTOMER_ROLES.MEMBER}>
                        member
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='workspace_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Workspace')}</FormLabel>
                  {!isPersonal && currentWorkspaceId > 0 ? (
                    <div className='border-input bg-muted/40 flex h-8 items-center rounded-md border px-3 text-sm font-medium'>
                      {currentWorkspaceName || `#${currentWorkspaceId}`}
                    </div>
                  ) : (
                    <Select
                      value={field.value}
                      items={[
                        { value: 'default', label: t('default') },
                        ...(ctx?.workspaces ?? []).map((ws: Workspace) => ({
                          value: String(ws.id),
                          label: ws.name,
                        })),
                      ]}
                      onValueChange={(v) => field.onChange(v ?? 'default')}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='default'>{t('default')}</SelectItem>
                        {(ctx?.workspaces ?? []).map((ws: Workspace) => (
                          <SelectItem key={ws.id} value={String(ws.id)}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='workspace_role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Workspace role')}</FormLabel>
                  <Select
                    value={field.value}
                    items={[
                      { value: WORKSPACE_ROLES.ADMIN, label: 'admin' },
                      { value: WORKSPACE_ROLES.MEMBER, label: 'member' },
                    ]}
                    onValueChange={(v) =>
                      field.onChange(v ?? WORKSPACE_ROLES.MEMBER)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={WORKSPACE_ROLES.ADMIN}>
                        admin
                      </SelectItem>
                      <SelectItem value={WORKSPACE_ROLES.MEMBER}>
                        member
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className={sideDrawerFooterClassName()}>
              <SheetClose render={<Button type='button' variant='outline' />}>
                {t('Cancel')}
              </SheetClose>
              <Button type='submit' disabled={form.formState.isSubmitting}>
                {t('Create Invitation')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
