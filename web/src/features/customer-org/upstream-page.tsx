/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { WorkspaceContextBanner } from './components/workspace-context-banner'
import { UpstreamDeleteDialog } from './components/upstream-delete-dialog'
import { UpstreamMutateDrawer } from './components/upstream-mutate-drawer'
import { UpstreamPrimaryButtons } from './components/upstream-primary-buttons'
import { UpstreamPriorityOrder } from './components/upstream-priority-order'
import {
  UpstreamProvider,
  useUpstream,
} from './components/upstream-provider'
import { UpstreamStatusDialog } from './components/upstream-status-dialog'
import { UpstreamTable } from './components/upstream-table'
import { useCustomerContext } from './hooks/use-customer-context'

function UpstreamContent() {
  const { t } = useTranslation()
  const { data: ctx, isLoading } = useCustomerContext()
  const { open, setOpen, currentRow } = useUpstream()

  if (isLoading) {
    return (
      <div className='text-muted-foreground p-6 text-sm'>{t('Loading...')}</div>
    )
  }

  if (!ctx?.customer) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('You are not a member of any customer.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!ctx.is_admin) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t('Only customer admins can manage BYOK credentials.')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!ctx.customer.byok_enabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground text-sm'>
            {t(
              'BYOK is not enabled for this customer. Ask a platform admin to enable it.'
            )}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Upstream / BYOK')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <UpstreamPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex min-h-0 flex-1 flex-col gap-3'>
            <WorkspaceContextBanner ctx={ctx} />
            <UpstreamPriorityOrder />
            <div className='min-h-0 flex-1'>
              <UpstreamTable />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <UpstreamMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow : null}
      />
      <UpstreamDeleteDialog />
      <UpstreamStatusDialog />
    </>
  )
}

export function UpstreamPage() {
  const { data: ctx } = useCustomerContext()
  const customerId = ctx?.customer?.id ?? 0

  return (
    <UpstreamProvider customerId={customerId}>
      <UpstreamContent />
    </UpstreamProvider>
  )
}
