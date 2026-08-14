/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useCallback, useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { InvitationsTable } from './components/invitations-table'
import { MembersConfirmDialogs } from './components/members-confirm-dialogs'
import { MembersInviteDrawer } from './components/members-invite-drawer'
import { MembersPrimaryButtons } from './components/members-primary-buttons'
import {
  MembersProvider,
  useMembers,
} from './components/members-provider'
import { MembersTable } from './components/members-table'
import { WorkspaceContextBanner } from './components/workspace-context-banner'
import { useCustomerContext } from './hooks/use-customer-context'
import { resolveCurrentWorkspace } from './lib/resolve-current-workspace'
import {
  type MembersSectionId,
  MEMBERS_DEFAULT_SECTION,
  MEMBERS_SECTION_IDS,
} from './section-registry'

const route = getRouteApi('/_authenticated/members/$section')

const SECTION_META: Record<MembersSectionId, { titleKey: string }> = {
  members: { titleKey: 'Members' },
  invitations: { titleKey: 'Invitations' },
}

function MembersContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: ctx, isLoading } = useCustomerContext()
  const { open, setOpen, isAdmin } = useMembers()
  const params = route.useParams()
  const activeSection = (params.section ??
    MEMBERS_DEFAULT_SECTION) as MembersSectionId

  const visibleSections = useMemo(
    () =>
      MEMBERS_SECTION_IDS.filter(
        (section) => section !== 'invitations' || isAdmin
      ),
    [isAdmin]
  )

  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/members/$section',
        params: { section: section as MembersSectionId },
      })
    },
    [navigate]
  )

  if (isLoading) {
    return (
      <div className='text-muted-foreground p-6 text-sm'>{t('Loading...')}</div>
    )
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

  const meta = SECTION_META[activeSection] ?? SECTION_META.members

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          {isAdmin ? <MembersPrimaryButtons /> : null}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-4'>
            <WorkspaceContextBanner ctx={ctx} />
            {visibleSections.length > 1 ? (
              <Tabs value={activeSection} onValueChange={handleSectionChange}>
                <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                  {visibleSections.map((section) => (
                    <TabsTrigger key={section} value={section}>
                      {t(SECTION_META[section].titleKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}
            <div className='min-h-0 flex-1'>
              {activeSection === 'invitations' && isAdmin ? (
                <InvitationsTable />
              ) : (
                <MembersTable />
              )}
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <MembersInviteDrawer
        open={open === 'invite'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      />
      <MembersConfirmDialogs />
    </>
  )
}

export function MembersPage() {
  const { data: ctx } = useCustomerContext()
  const { currentWorkspaceId, currentWorkspace, isPersonal } =
    resolveCurrentWorkspace(ctx)

  return (
    <MembersProvider
      customerId={ctx?.customer?.id ?? 0}
      isAdmin={Boolean(ctx?.is_admin)}
      isPersonal={isPersonal}
      currentWorkspaceId={currentWorkspaceId}
      currentWorkspaceName={currentWorkspace?.name ?? ''}
    >
      <MembersContent />
    </MembersProvider>
  )
}
