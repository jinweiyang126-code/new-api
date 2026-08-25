/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'

import { acceptInvitation } from './api'
import { apiErrorMessage } from './lib/api-message'

type Props = {
  initialToken?: string
}

export function AcceptInvitationPage({ initialToken = '' }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.auth.user)
  const [token, setToken] = useState(initialToken)

  const acceptMut = useMutation({
    mutationFn: async () => {
      const res = await acceptInvitation(token.trim())
      if (!res.success) {
        throw new Error(
          apiErrorMessage(t, res.message, 'Failed to accept invitation')
        )
      }
      return res.data
    },
    onSuccess: () => {
      toast.success(t('Invitation accepted'))
      void queryClient.invalidateQueries({ queryKey: ['self-customer'] })
      void navigate({ to: '/workspaces' })
    },
    onError: (e: Error) => {
      const msg = e.message || t('Failed to accept invitation')
      if (/already a member of this customer/i.test(msg) || /已是该客户成员/.test(msg)) {
        toast.error(t('You are already a member of this organization.'))
        return
      }
      if (/already belongs to a customer/i.test(msg) || /已归属其他客户/.test(msg)) {
        // Legacy single-customer error; should no longer occur for cross-customer invites.
        toast.error(
          t(
            'You already belong to a customer and cannot accept this invitation.'
          )
        )
        return
      }
      toast.error(msg)
    },
  })

  if (!user) {
    const redirect = `/invitations/accept?token=${encodeURIComponent(token.trim())}`
    return (
      <div className='mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6'>
        <h1 className='text-xl font-semibold'>{t('Accept Invitation')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('Please sign in to accept this invitation.')}
        </p>
        <Link
          to='/sign-in'
          search={{ redirect }}
          className='inline-flex'
        >
          <Button type='button'>{t('Sign in')}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className='mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6'>
      <h1 className='text-xl font-semibold'>{t('Accept Invitation')}</h1>
      <p className='text-muted-foreground text-sm'>
        {t('Join the customer organization using your invitation token.')}
      </p>
      <div className='space-y-1'>
        <Label>{t('Invitation token')}</Label>
        <Input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t('Invitation token')}
        />
      </div>
      <Button
        disabled={!token.trim() || acceptMut.isPending}
        onClick={() => acceptMut.mutate()}
      >
        {t('Accept')}
      </Button>
    </div>
  )
}
