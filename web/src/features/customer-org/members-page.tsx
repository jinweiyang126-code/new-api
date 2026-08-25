/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useCallback, useMemo, useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  ORG_FILTER_ALL,
  OrgScopeFilters,
} from './components/org-scope-filters'
import {
  useCustomerContext,
  useSetCurrentCustomer,
} from './hooks/use-customer-context'
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

function MembersContent({
  workspaceFilter,
  onWorkspaceFilterChange,
}: {
  workspaceFilter: string
  onWorkspaceFilterChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: ctx, isLoading } = useCustomerContext()
  const setCurrentCustomer = useSetCurrentCustomer()
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


  const customers = useMemo(
    () =>
      (ctx?.customers ?? []).map((c) => ({
        id: c.customer_id,
        name: c.customer_name,
      })),
    [ctx?.customers]
  )

  const showCustomerFilter = customers.length > 1
  const selectedCustomerId = showCustomerFilter
    ? String(ctx?.customer?.id ?? ORG_FILTER_ALL)
    : ORG_FILTER_ALL

  const handleCustomerChange = (value: string) => {
    const id = Number(value)
    if (!id || id === ctx?.customer?.id) return
    setCurrentCustomer.mutate(id, {
      onError: (e: Error) => {
        toast.error(e.message)
      },
    })
  }

  const workspaces = useMemo(
    () =>
      (ctx?.workspaces ?? []).map((ws) => ({
        id: ws.id,
        name: ws.name,
      })),
    [ctx?.workspaces]
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
            <OrgScopeFilters
              customers={customers}
              workspaces={workspaces}
              customerId={selectedCustomerId}
              workspaceId={workspaceFilter}
              onCustomerChange={handleCustomerChange}
              onWorkspaceChange={onWorkspaceFilterChange}
              showCustomerFilter={showCustomerFilter}
              customerIncludeAll={false}
            />
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
  const [workspaceFilter, setWorkspaceFilter] = useState(ORG_FILTER_ALL)
  const isPersonal = workspaceFilter === ORG_FILTER_ALL
  const currentWorkspaceId = isPersonal ? 0 : Number(workspaceFilter) || 0
  const currentWorkspaceName =
    ctx?.workspaces?.find((ws) => ws.id === currentWorkspaceId)?.name ?? ''

  return (
    <MembersProvider
      customerId={ctx?.customer?.id ?? 0}
      isAdmin={Boolean(ctx?.is_admin)}
      isPersonal={isPersonal}
      currentWorkspaceId={currentWorkspaceId}
      currentWorkspaceName={currentWorkspaceName}
    >
      <MembersContent
        workspaceFilter={workspaceFilter}
        onWorkspaceFilterChange={setWorkspaceFilter}
      />
    </MembersProvider>
  )
}
