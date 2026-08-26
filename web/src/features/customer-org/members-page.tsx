/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  getCustomerInvitations,
  getCustomerMembers,
  getWorkspaceMembers,
} from './api'
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
import { filterInvitationsByWorkspace } from './lib/filter-invitations'
import {
  type MembersSectionId,
  MEMBERS_DEFAULT_SECTION,
  MEMBERS_SECTION_IDS,
} from './section-registry'

const route = getRouteApi('/_authenticated/members/$section')

function MembersContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: ctx, isLoading } = useCustomerContext()
  const setCurrentCustomer = useSetCurrentCustomer()
  const {
    open,
    setOpen,
    isAdmin,
    customerId,
    isPersonal,
    currentWorkspaceId,
    refreshTrigger,
  } = useMembers()
  const params = route.useParams()
  const activeSection = (params.section ??
    MEMBERS_DEFAULT_SECTION) as MembersSectionId

  const { data: membersCount = 0 } = useQuery({
    queryKey: [
      'members-count',
      customerId,
      isPersonal,
      currentWorkspaceId,
      refreshTrigger,
    ],
    enabled: customerId > 0 && (isPersonal || currentWorkspaceId > 0),
    queryFn: async () => {
      if (isPersonal) {
        const res = await getCustomerMembers(customerId)
        return res.success ? (res.data?.length ?? 0) : 0
      }
      const res = await getWorkspaceMembers(currentWorkspaceId)
      return res.success ? (res.data?.length ?? 0) : 0
    },
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['customer-invitations', customerId, refreshTrigger],
    enabled: customerId > 0 && isAdmin,
    queryFn: async () => {
      const res = await getCustomerInvitations(customerId)
      if (!res.success) return []
      return res.data ?? []
    },
  })

  const invitationsCount = useMemo(
    () =>
      filterInvitationsByWorkspace(invitations, {
        showAll: isPersonal,
        workspaceId: currentWorkspaceId,
        isDefaultWorkspace: Boolean(
          ctx?.workspaces?.find((ws) => ws.id === currentWorkspaceId)
            ?.is_default
        ),
      }).length,
    [
      invitations,
      isPersonal,
      currentWorkspaceId,
      ctx?.workspaces,
    ]
  )

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

  const sectionLabel = (section: MembersSectionId) => {
    if (section === 'invitations') {
      return t('Invitations ({{count}})', { count: invitationsCount })
    }
    return t('Members ({{count}})', { count: membersCount })
  }

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

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {sectionLabel(activeSection)}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          {isAdmin ? <MembersPrimaryButtons /> : null}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-4'>
            {showCustomerFilter ? (
              <OrgScopeFilters
                customers={customers}
                workspaces={[]}
                customerId={selectedCustomerId}
                workspaceId={ORG_FILTER_ALL}
                onCustomerChange={handleCustomerChange}
                onWorkspaceChange={() => undefined}
                showCustomerFilter
                customerIncludeAll={false}
                showWorkspaceFilter={false}
              />
            ) : null}
            {visibleSections.length > 1 ? (
              <Tabs value={activeSection} onValueChange={handleSectionChange}>
                <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                  {visibleSections.map((section) => (
                    <TabsTrigger key={section} value={section}>
                      {sectionLabel(section)}
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
  const search = route.useSearch()
  const workspaceFilter = search.mWorkspace?.[0] ?? ORG_FILTER_ALL
  const isPersonal =
    !workspaceFilter || workspaceFilter === ORG_FILTER_ALL
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
      <MembersContent />
    </MembersProvider>
  )
}
