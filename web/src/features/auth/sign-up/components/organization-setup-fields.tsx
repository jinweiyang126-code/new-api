/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className='grid gap-4'>
      <div className='grid gap-2'>
        <Label htmlFor='organization-name'>{t('Organization name')}</Label>
        <Input
          id='organization-name'
          value={organizationName}
          onChange={(event) => onOrganizationNameChange(event.target.value)}
          placeholder={t('Enter your organization name')}
          autoComplete='organization'
          disabled={disabled}
          maxLength={128}
        />
      </div>
      <div className='grid gap-2'>
        <Label>{t('Invite teammates (optional)')}</Label>
        {inviteEmails.map((field, index) => (
          <div key={field.key} className='flex items-center gap-2'>
            <Input
              type='email'
              value={field.value}
              onChange={(event) => {
                const next = [...inviteEmails]
                next[index] = { ...field, value: event.target.value }
                onInviteEmailsChange(next)
              }}
              placeholder={t('name@example.com')}
              disabled={disabled}
            />
            {inviteEmails.length > 1 ? (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                disabled={disabled}
                onClick={() =>
                  onInviteEmailsChange(
                    inviteEmails.filter((item) => item.key !== field.key)
                  )
                }
                aria-label={t('Remove')}
              >
                <X className='h-4 w-4' />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type='button'
          variant='outline'
          className='w-fit gap-1.5'
          disabled={disabled || inviteEmails.length >= MAX_INVITE_EMAILS}
          onClick={() =>
            onInviteEmailsChange([...inviteEmails, createInviteField()])
          }
        >
          <Plus className='h-4 w-4' />
          {t('Add another email')}
        </Button>
      </div>
    </div>
  )
}
