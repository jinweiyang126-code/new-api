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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  createCustomerInvitation,
  getCustomerInvitations,
  getCustomerMembers,
  removeCustomerMember,
  revokeInvitation,
} from './api'
import { CUSTOMER_ROLES, WORKSPACE_ROLES } from './constants'
import { useCustomerContext } from './hooks/use-customer-context'
import type { CustomerMember, Invitation, Workspace } from './types'

export function MembersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const isAdmin = Boolean(ctx?.is_admin)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState(CUSTOMER_ROLES.MEMBER)
  const [workspaceRole, setWorkspaceRole] = useState(WORKSPACE_ROLES.MEMBER)
  const [workspaceId, setWorkspaceId] = useState('default')

  const { data: members = [] } = useQuery({
    queryKey: ['customer-members', customerId],
    enabled: customerId > 0,
    queryFn: async () => {
      const res = await getCustomerMembers(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['customer-invitations', customerId],
    enabled: customerId > 0 && isAdmin,
    queryFn: async () => {
      const res = await getCustomerInvitations(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const inviteMut = useMutation({
    mutationFn: async () => {
      const payload: {
        email?: string
        role: string
        workspace_role: string
        workspace_id?: number
      } = {
        email: email.trim() || undefined,
        role,
        workspace_role: workspaceRole,
      }
      if (workspaceId !== 'default') {
        payload.workspace_id = Number(workspaceId)
      }
      const res = await createCustomerInvitation(customerId, payload)
      if (!res.success || !res.data) throw new Error(res.message)
      return res.data
    },
    onSuccess: async (inv) => {
      const link = `${window.location.origin}/invitations/accept?token=${encodeURIComponent(inv.token)}`
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        // ignore clipboard failures; toast still covers outcome
      }
      if (inv.email_sent) {
        toast.success(t('Invitation created. Email sent.'))
      } else if (inv.email?.trim()) {
        toast.success(t('Invitation created. Email not sent.'))
        if (inv.email_error) {
          toast.message(inv.email_error)
        }
      } else {
        toast.success(t('Invitation created. Link copied.'))
      }
      setEmail('')
      void queryClient.invalidateQueries({ queryKey: ['customer-invitations'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMut = useMutation({
    mutationFn: async (userId: number) => {
      const res = await removeCustomerMember(customerId, userId)
      if (!res.success) throw new Error(res.message)
    },
    onSuccess: () => {
      toast.success(t('Member removed'))
      void queryClient.invalidateQueries({ queryKey: ['customer-members'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await revokeInvitation(id)
      if (!res.success) throw new Error(res.message)
    },
    onSuccess: () => {
      toast.success(t('Invitation revoked'))
      void queryClient.invalidateQueries({ queryKey: ['customer-invitations'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (ctxLoading) {
    return <div className='p-6 text-sm text-muted-foreground'>{t('Loading...')}</div>
  }
  if (!ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Members & Invitations')}
        </SectionPageLayout.Title>
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
      <SectionPageLayout.Title>
        {t('Members & Invitations')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <section className='space-y-3'>
            <h3 className='text-sm font-semibold'>{t('Members')}</h3>
            {members.map((m: CustomerMember) => (
              <div
                key={m.id}
                className='flex items-center justify-between rounded-md border px-4 py-3 text-sm'
              >
                <div>
                  <div className='font-medium'>
                    {m.username || `User #${m.user_id}`}
                  </div>
                  <div className='text-muted-foreground text-xs'>{m.role}</div>
                </div>
                {isAdmin && m.role !== CUSTOMER_ROLES.OWNER ? (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={removeMut.isPending}
                    onClick={() => removeMut.mutate(m.user_id)}
                  >
                    {t('Remove')}
                  </Button>
                ) : null}
              </div>
            ))}
          </section>

          {isAdmin ? (
            <>
              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>{t('Invite member')}</h3>
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='space-y-1'>
                    <Label>{t('Email')}</Label>
                    <Input
                      type='email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('Invitee email (required to send mail)')}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label>{t('Customer role')}</Label>
                    <Select
                      value={role}
                      items={[
                        { value: CUSTOMER_ROLES.ADMIN, label: 'admin' },
                        { value: CUSTOMER_ROLES.MEMBER, label: 'member' },
                      ]}
                      onValueChange={(v) => setRole(v ?? CUSTOMER_ROLES.MEMBER)}
                    >
                      <SelectTrigger className='w-36'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CUSTOMER_ROLES.ADMIN}>
                          admin
                        </SelectItem>
                        <SelectItem value={CUSTOMER_ROLES.MEMBER}>
                          member
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1'>
                    <Label>{t('Workspace')}</Label>
                    <Select
                      value={workspaceId}
                      items={[
                        { value: 'default', label: t('default') },
                        ...(ctx.workspaces ?? []).map((ws: Workspace) => ({
                          value: String(ws.id),
                          label: ws.name,
                        })),
                      ]}
                      onValueChange={(v) => setWorkspaceId(v ?? 'default')}
                    >
                      <SelectTrigger className='w-44'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='default'>
                          {t('default')}
                        </SelectItem>
                        {(ctx.workspaces ?? []).map((ws: Workspace) => (
                          <SelectItem key={ws.id} value={String(ws.id)}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1'>
                    <Label>{t('Workspace role')}</Label>
                    <Select
                      value={workspaceRole}
                      items={[
                        { value: WORKSPACE_ROLES.ADMIN, label: 'admin' },
                        { value: WORKSPACE_ROLES.MEMBER, label: 'member' },
                      ]}
                      onValueChange={(v) =>
                        setWorkspaceRole(v ?? WORKSPACE_ROLES.MEMBER)
                      }
                    >
                      <SelectTrigger className='w-36'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WORKSPACE_ROLES.ADMIN}>
                          admin
                        </SelectItem>
                        <SelectItem value={WORKSPACE_ROLES.MEMBER}>
                          member
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    disabled={inviteMut.isPending}
                    onClick={() => inviteMut.mutate()}
                  >
                    {t('Create Invitation')}
                  </Button>
                </div>
              </section>

              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>{t('Invitations')}</h3>
                {invitations.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No invitations')}
                  </p>
                ) : (
                  invitations.map((inv: Invitation) => (
                    <div
                      key={inv.id}
                      className='flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
                    >
                      <div>
                        <div className='font-medium'>
                          {inv.email || t('Open invite')} · {inv.status}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {inv.role} / {inv.workspace_role}
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        {inv.status === 'pending' ? (
                          <>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={async () => {
                                const link = `${window.location.origin}/invitations/accept?token=${encodeURIComponent(inv.token)}`
                                try {
                                  await navigator.clipboard.writeText(link)
                                  toast.success(t('Link copied'))
                                } catch {
                                  toast.message(link)
                                }
                              }}
                            >
                              {t('Copy link')}
                            </Button>
                            <Button
                              size='sm'
                              variant='outline'
                              disabled={revokeMut.isPending}
                              onClick={() => revokeMut.mutate(inv.id)}
                            >
                              {t('Revoke')}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </section>
            </>
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
