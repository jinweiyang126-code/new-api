/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type WeChatLoginDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCodeUrl: string
  code: string
  onCodeChange: (value: string) => void
  onConfirm: () => void
  submitting: boolean
  confirmDisabled?: boolean
}

export function WeChatLoginDialog({
  open,
  onOpenChange,
  qrCodeUrl,
  code,
  onCodeChange,
  onConfirm,
  submitting,
  confirmDisabled,
}: WeChatLoginDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('WeChat sign in')}
      description={t(
        'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
      )}
      contentClassName='max-w-sm'
      headerClassName='text-left'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={onConfirm}
            disabled={submitting || !code.trim() || confirmDisabled}
            className='gap-2'
          >
            {submitting ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {t('Confirm')}
          </Button>
        </>
      }
    >
      {qrCodeUrl ? (
        <div className='flex justify-center'>
          <img
            src={qrCodeUrl}
            alt={t('WeChat login QR code')}
            className='h-40 w-40 rounded-md border object-contain'
          />
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>
          {t('QR code is not configured. Please contact support.')}
        </p>
      )}
      <div className='grid gap-2'>
        <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
        <Input
          id='wechat-code'
          placeholder={t('Enter the verification code')}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          autoComplete='one-time-code'
        />
      </div>
    </Dialog>
  )
}
