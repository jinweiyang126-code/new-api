/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
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
  getWorkspaceMembers,
  removeCustomerMember,
  revokeInvitation,
} from './api'
import { WorkspaceContextBanner } from './components/workspace-context-banner'
import { CUSTOMER_ROLES, WORKSPACE_ROLES } from './constants'
import { useCustomerContext } from './hooks/use-customer-context'
import { resolveCurrentWorkspace } from './lib/resolve-current-workspace'
import type {
  CustomerMember,
  Invitation,
  Workspace,
  WorkspaceMember,
} from './types'

export function MembersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: ctx, isLoading: ctxLoading } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0
  const isAdmin = Boolean(ctx?.is_admin)
  const {
    currentWorkspaceId,
    currentWorkspace,
    isPersonal,
  } = resolveCurrentWorkspace(ctx)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState(CUSTOMER_ROLES.MEMBER)
  const [workspaceRole, setWorkspaceRole] = useState(WORKSPACE_ROLES.MEMBER)
  const [workspaceId, setWorkspaceId] = useState('default')

  useEffect(() => {
    if (isPersonal) {
      setWorkspaceId('default')
      return
    }
    const exists = (ctx?.workspaces ?? []).some(
      (w: Workspace) => w.id === currentWorkspaceId
    )
    setWorkspaceId(exists ? String(currentWorkspaceId) : 'default')
  }, [currentWorkspaceId, isPersonal, ctx?.workspaces])

  const { data: customerMembers = [] } = useQuery({
    queryKey: ['customer-members', customerId],
    enabled: customerId > 0 && isPersonal,
    queryFn: async () => {
      const res = await getCustomerMembers(customerId)
      if (!res.success) throw new Error(res.message)
      return res.data ?? []
    },
  })

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ['workspace-members', currentWorkspaceId],
    enabled: !isPersonal && currentWorkspaceId > 0,
    queryFn: async () => {
      const res = await getWorkspaceMembers(currentWorkspaceId)
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

  const filteredInvitations = useMemo(() => {
    if (isPersonal) return invitations
    return invitations.filter((inv: Invitation) => {
      if (inv.workspace_id == null || inv.workspace_id === 0) {
        return Boolean(currentWorkspace?.is_default)
      }
      return inv.workspace_id === currentWorkspaceId
    })
  }, [invitations, isPersonal, currentWorkspaceId, currentWorkspace?.is_default])

  const inviteMut = useMutation({
    mutationFn: async () => {
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        throw new Error(t('Invitee email is required'))
      }
      const payload: {
        email: string
        role: string
        workspace_role: string
        workspace_id?: number
      } = {
        email: trimmedEmail,
        role,
        workspace_role: workspaceRole,
      }
      if (!isPersonal && currentWorkspaceId > 0) {
        payload.workspace_id = currentWorkspaceId
      } else if (workspaceId !== 'default') {
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
        // ignore clipboard failures
      }
      if (inv.email_sent) {
        toast.success(t('Invitation created. Email sent.'))
      } else {
        toast.success(t('Invitation created. Email not sent.'))
        if (inv.email_error) {
          toast.message(inv.email_error)
        }
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
      void queryClient.invalidateQueries({ queryKey: ['workspace-members'] })
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
          <WorkspaceContextBanner ctx={ctx} />

          {isPersonal ? (
            <section className='space-y-3'>
              <h3 className='text-sm font-semibold'>
                {t('Customer members')}
              </h3>
              <p className='text-muted-foreground text-xs'>
                {t('Switch to a workspace to see its members.')}
              </p>
              {customerMembers.map((m: CustomerMember) => (
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
          ) : (
            <section className='space-y-3'>
              <h3 className='text-sm font-semibold'>
                {t('Workspace members')} —{' '}
                {currentWorkspace?.name ?? `#${currentWorkspaceId}`}
              </h3>
              {workspaceMembers.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No workspace members')}
                </p>
              ) : (
                workspaceMembers.map((m: WorkspaceMember) => (
                  <div
                    key={m.id}
                    className='flex items-center justify-between rounded-md border px-4 py-3 text-sm'
                  >
                    <div>
                      <div className='font-medium'>
                        {m.username || `User #${m.user_id}`}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {m.role}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {isAdmin ? (
            <>
              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>{t('Invite member')}</h3>
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='space-y-1'>
                    <Label>{t('Email')}</Label>
                    <Input
                      type='email'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('Invitee email')}
                      className='w-56'
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
                  {isPersonal ? (
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
                  ) : (
                    <div className='space-y-1'>
                      <Label>{t('Workspace')}</Label>
                      <div className='border-input bg-muted/40 flex h-8 w-44 items-center rounded-md border px-3 text-sm font-medium'>
                        {currentWorkspace?.name ?? `#${currentWorkspaceId}`}
                      </div>
                    </div>
                  )}
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
                    className='h-8'
                    disabled={inviteMut.isPending}
                    onClick={() => inviteMut.mutate()}
                  >
                    {t('Create Invitation')}
                  </Button>
                </div>
              </section>

              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>
                  {isPersonal
                    ? t('Invitations')
                    : `${t('Invitations')} — ${currentWorkspace?.name ?? `#${currentWorkspaceId}`}`}
                </h3>
                {filteredInvitations.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No invitations')}
                  </p>
                ) : (
                  filteredInvitations.map((inv: Invitation) => (
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
