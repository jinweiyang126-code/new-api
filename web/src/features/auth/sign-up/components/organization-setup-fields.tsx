/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  AuthFieldLabel,
  AuthTextField,
} from '@/features/auth/components/auth-text-field'

type InviteEmailField = {
  key: string
  value: string
}

function createInviteField(value = ''): InviteEmailField {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value }
}

const MAX_INVITE_EMAILS = 10

type OrganizationSetupFieldsProps = {
  organizationName: string
  onOrganizationNameChange: (value: string) => void
  inviteEmails: InviteEmailField[]
  onInviteEmailsChange: (emails: InviteEmailField[]) => void
  disabled?: boolean
}

export function OrganizationSetupFields({
  organizationName,
  onOrganizationNameChange,
  inviteEmails,
  onInviteEmailsChange,
  disabled = false,
}: OrganizationSetupFieldsProps) {
  const { t } = useTranslation()

  return (
    <div className='flex w-full flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <AuthFieldLabel label={t('Organization name')} />
        <AuthTextField
          id='organization-name'
          value={organizationName}
          onChange={(event) => onOrganizationNameChange(event.target.value)}
          placeholder={t('Enter your organization name')}
          autoComplete='organization'
          disabled={disabled}
          maxLength={128}
        />
      </div>
      <div className='flex flex-col gap-2'>
        <AuthFieldLabel label={t('Invite teammates (optional)')} />
        {inviteEmails.map((field, index) => (
          <div key={field.key} className='flex items-center gap-2'>
            <AuthTextField
              type='email'
              inputMode='email'
              value={field.value}
              onChange={(event) => {
                const next = [...inviteEmails]
                next[index] = { ...field, value: event.target.value }
                onInviteEmailsChange(next)
              }}
              placeholder={t('name@example.com')}
              disabled={disabled}
              className='min-w-0 flex-1'
            />
            {inviteEmails.length > 1 ? (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-11 shrink-0'
                disabled={disabled}
                onClick={() =>
                  onInviteEmailsChange(
                    inviteEmails.filter((item) => item.key !== field.key)
                  )
                }
                aria-label={t('Remove')}
              >
                <X className='size-4' />
              </Button>
            ) : null}
          </div>
        ))}
        <button
          type='button'
          disabled={disabled || inviteEmails.length >= MAX_INVITE_EMAILS}
          onClick={() =>
            onInviteEmailsChange([...inviteEmails, createInviteField()])
          }
          className='inline-flex w-fit items-center gap-1.5 text-sm font-normal text-foreground disabled:pointer-events-none disabled:opacity-50'
        >
          <Plus className='size-4' />
          {t('Add another email')}
        </button>
      </div>
    </div>
  )
}
