/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { CreateOrganizationDrawer } from './components/create-organization-drawer'
import { WorkspacesMutateDrawer } from './components/workspaces-mutate-drawer'
import { WorkspacesPrimaryButtons } from './components/workspaces-primary-buttons'
import {
  WorkspacesProvider,
  useWorkspaces,
} from './components/workspaces-provider'
import { WorkspacesStatusDialog } from './components/workspaces-status-dialog'
import { WorkspacesTable } from './components/workspaces-table'
import { useCustomerContext } from './hooks/use-customer-context'
import { resolveCurrentWorkspace } from './lib/resolve-current-workspace'

function WorkspacesContent() {
  const { t } = useTranslation()
  const { data: ctx, isLoading } = useCustomerContext()
  const { open, setOpen, currentRow } = useWorkspaces()
  const [createOrgOpen, setCreateOrgOpen] = useState(false)

  if (isLoading) {
    return (
      <div className='text-muted-foreground p-6 text-sm'>{t('Loading...')}</div>
    )
  }

  if (!ctx?.customer) {
    return (
      <>
        <SectionPageLayout>
          <SectionPageLayout.Title>{t('Workspaces')}</SectionPageLayout.Title>
          <SectionPageLayout.Actions>
            <WorkspacesPrimaryButtons
              onCreateOrganization={() => setCreateOrgOpen(true)}
            />
          </SectionPageLayout.Actions>
          <SectionPageLayout.Content>
            <p className='text-muted-foreground text-sm'>
              {t('You are not a member of any customer.')}
            </p>
          </SectionPageLayout.Content>
        </SectionPageLayout>
        <CreateOrganizationDrawer
          open={createOrgOpen}
          onOpenChange={setCreateOrgOpen}
        />
      </>
    )
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Workspaces')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <WorkspacesPrimaryButtons onCreateOrganization={() => setCreateOrgOpen(true)} />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex min-h-0 flex-1 flex-col gap-3'>
            <div className='min-h-0 flex-1'>
              <WorkspacesTable />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <WorkspacesMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow : null}
      />
      <WorkspacesStatusDialog />
      <CreateOrganizationDrawer
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
      />
    </>
  )
}

export function WorkspacesPage() {
  const { data: ctx } = useCustomerContext()
  const { currentWorkspaceId } = resolveCurrentWorkspace(ctx)
  const isAdmin = Boolean(ctx?.is_admin)

  return (
    <WorkspacesProvider
      isAdmin={isAdmin}
      currentWorkspaceId={currentWorkspaceId}
    >
      <WorkspacesContent />
    </WorkspacesProvider>
  )
}
