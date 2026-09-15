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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'

import { getVendors } from '../../api'
import { handleDeleteVendor, vendorsQueryKeys } from '../../lib'
import type { Vendor } from '../../types'

type VendorManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateVendor: () => void
  onEditVendor: (vendor: Vendor) => void
}

export function VendorManagementDialog({
  open,
  onOpenChange,
  onCreateVendor,
  onEditVendor,
}: VendorManagementDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [deleteState, setDeleteState] = useState<{
    open: boolean
    vendor: Vendor | null
  }>({ open: false, vendor: null })
  const [isDeleting, setIsDeleting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = useMemo(() => {
    const items = data?.data?.items ?? []
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [data?.data?.items])

  useEffect(() => {
    if (!open) {
      setDeleteState({ open: false, vendor: null })
      setIsDeleting(false)
    }
  }, [open])

  const handleDeleteConfirm = async () => {
    if (!deleteState.vendor) return
    setIsDeleting(true)
    try {
      await handleDeleteVendor(deleteState.vendor.id, queryClient, () => {
        setDeleteState({ open: false, vendor: null })
      })
    } finally {
      setIsDeleting(false)
    }
  }

  let body: ReactNode
  if (isLoading) {
    body = (
      <div className='flex flex-col items-center justify-center gap-2 py-12 text-center'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        <p className='text-muted-foreground text-sm'>{t('Loading vendors...')}</p>
      </div>
    )
  } else if (vendors.length === 0) {
    body = (
      <Empty className='border border-dashed py-10'>
        <EmptyMedia variant='icon'>
          <Building2 className='h-6 w-6' />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{t('No vendors yet')}</EmptyTitle>
          <EmptyDescription>
            {t('Create a vendor to label models in Model Square and admin lists.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button className='mt-4' onClick={onCreateVendor}>
          <Plus className='h-4 w-4' />
          {t('Create Vendor')}
        </Button>
      </Empty>
    )
  } else {
    body = (
      <ul className='divide-border/70 divide-y rounded-lg border'>
        {vendors.map((vendor) => {
          const icon = vendor.icon ? getLobeIcon(vendor.icon, 20) : null
          return (
            <li
              key={vendor.id}
              className='flex items-start justify-between gap-3 px-3 py-3'
            >
              <div className='flex min-w-0 items-start gap-3'>
                <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-full'>
                  {icon || (
                    <span className='text-muted-foreground text-sm font-semibold'>
                      {vendor.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className='min-w-0 space-y-1'>
                  <p className='truncate text-sm font-medium'>{vendor.name}</p>
                  <p className='text-muted-foreground line-clamp-2 text-xs'>
                    {vendor.description?.trim()
                      ? vendor.description
                      : t('No description')}
                  </p>
                  {vendor.icon ? (
                    <p className='text-muted-foreground font-mono text-[11px]'>
                      {vendor.icon}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  onClick={() => onEditVendor(vendor)}
                >
                  <Pencil className='h-4 w-4' />
                  <span className='sr-only'>{t('Edit Vendor')}</span>
                </Button>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='text-destructive hover:text-destructive'
                  onClick={() => setDeleteState({ open: true, vendor })}
                >
                  <Trash2 className='h-4 w-4' />
                  <span className='sr-only'>{t('Delete Vendor')}</span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('Manage Vendors')}
        description={t('Create, edit, or delete model vendors')}
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('Close')}
            </Button>
            <Button type='button' onClick={onCreateVendor}>
              <Plus className='h-4 w-4' />
              {t('Create Vendor')}
            </Button>
          </>
        }
      >
        {body}
      </Dialog>

      <ConfirmDialog
        open={deleteState.open}
        onOpenChange={(next) => {
          if (!next) setDeleteState({ open: false, vendor: null })
        }}
        title={t('Delete Vendor')}
        desc={t('Delete vendor "{{name}}"? Models linked to it will lose this vendor.', {
          name: deleteState.vendor?.name ?? '',
        })}
        confirmText={t('Delete')}
        destructive
        isLoading={isDeleting}
        handleConfirm={() => void handleDeleteConfirm()}
      />
    </>
  )
}
