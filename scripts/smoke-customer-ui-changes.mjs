/*
Copyright (C) 2023-2026 QuantumNous
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(__dirname, '..')
const webSrc = path.join(repo, 'web/src')

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8')
}

function loadLocale(file) {
  const json = JSON.parse(fs.readFileSync(path.join(webSrc, file), 'utf8'))
  return json.translation || json
}

const en = loadLocale('i18n/locales/en.json')
const zh = loadLocale('i18n/locales/zh.json')

const keys = [
  'Edit Customer',
  'Customer updated',
  'Customer details (read only)',
  'Edit customer name, remark, upstream, and channel bindings.',
  'No channel bindings',
  'Upstream settings saved',
  'Select channel',
  'Search channel...',
  'No channels found',
  'Please select a channel',
  'Use platform global channels only. Default mode; same as existing routing.',
  'Prefer channels bound to this customer. Falls back to global only when allowed.',
  "Prefer the customer's own upstream credentials (BYOK). Requires BYOK enabled.",
  'Try BYOK and dedicated bindings first, then fall back to global when allowed.',
  'Edit Workspace',
  'Update workspace name.',
  'Workspace updated',
  'Actions',
  'Edit',
  'Members',
  'Invitations',
  'Invite member',
  'No members',
  'No invitations',
  'Remove member',
  'Revoke invitation',
  'Failed to load members',
  'Failed to load invitations',
  'Send an invitation email and copy the accept link.',
  'Create an invitation to add collaborators.',
  'Filter by username or role...',
  'Filter by email, role, or status...',
  'Expires At',
  'Add Credential',
]

const missingEn = keys.filter((k) => !(k in en))
const missingZh = keys.filter((k) => !(k in zh))

const mustExist = [
  'web/src/features/customers/components/channel-picker.tsx',
  'web/src/features/customers/components/customers-edit-drawer.tsx',
  'web/src/features/customers/components/data-table-bulk-actions.tsx',
  'web/src/features/customer-org/components/workspaces-bulk-actions.tsx',
  'web/src/features/customer-org/section-registry.ts',
  'web/src/routes/_authenticated/members/$section.tsx',
  'web/src/features/customer-org/components/members-table.tsx',
  'web/src/features/customer-org/components/members-columns.tsx',
  'web/src/features/customer-org/components/members-row-actions.tsx',
  'web/src/features/customer-org/components/members-invite-drawer.tsx',
  'web/src/features/customer-org/components/invitations-table.tsx',
  'web/src/features/customer-org/components/invitations-columns.tsx',
  'web/src/features/customer-org/components/invitations-row-actions.tsx',
  'web/src/features/customer-org/components/upstream-table.tsx',
  'web/src/features/customer-org/components/upstream-columns.tsx',
  'web/src/features/customer-org/components/upstream-mutate-drawer.tsx',
  'docs/design/admin-list-page-standard.md',
]

const files = {
  customersTable: read('web/src/features/customers/components/customers-table.tsx'),
  customersCols: read('web/src/features/customers/components/customers-columns.tsx'),
  customersActions: read(
    'web/src/features/customers/components/data-table-row-actions.tsx'
  ),
  customersEdit: read(
    'web/src/features/customers/components/customers-edit-drawer.tsx'
  ),
  customersDetail: read(
    'web/src/features/customers/components/customers-detail-drawer.tsx'
  ),
  wsTable: read(
    'web/src/features/customer-org/components/workspaces-table.tsx'
  ),
  wsCols: read(
    'web/src/features/customer-org/components/workspaces-columns.tsx'
  ),
  wsActions: read(
    'web/src/features/customer-org/components/workspaces-row-actions.tsx'
  ),
  membersPage: read('web/src/features/customer-org/members-page.tsx'),
  membersRegistry: read('web/src/features/customer-org/section-registry.ts'),
  membersRoute: read('web/src/routes/_authenticated/members/$section.tsx'),
  membersIndex: read('web/src/routes/_authenticated/members/index.tsx'),
  membersTable: read(
    'web/src/features/customer-org/components/members-table.tsx'
  ),
  membersCols: read(
    'web/src/features/customer-org/components/members-columns.tsx'
  ),
  membersActions: read(
    'web/src/features/customer-org/components/members-row-actions.tsx'
  ),
  membersInvite: read(
    'web/src/features/customer-org/components/members-invite-drawer.tsx'
  ),
  invitationsTable: read(
    'web/src/features/customer-org/components/invitations-table.tsx'
  ),
  invitationsCols: read(
    'web/src/features/customer-org/components/invitations-columns.tsx'
  ),
  invitationsActions: read(
    'web/src/features/customer-org/components/invitations-row-actions.tsx'
  ),
  upstreamPage: read('web/src/features/customer-org/upstream-page.tsx'),
  upstreamTable: read(
    'web/src/features/customer-org/components/upstream-table.tsx'
  ),
  upstreamCols: read(
    'web/src/features/customer-org/components/upstream-columns.tsx'
  ),
  upstreamActions: read(
    'web/src/features/customer-org/components/upstream-row-actions.tsx'
  ),
  sidebarData: read('web/src/hooks/use-sidebar-data.ts'),
  listStandard: read('docs/design/admin-list-page-standard.md'),
  customerGo: read('model/customer.go'),
  bindingGo: read('model/customer_channel_binding.go'),
  upstreamGo: read('model/customer_upstream_ops.go'),
}

const checks = [
  ['i18n en keys', missingEn.length === 0],
  ['i18n zh keys', missingZh.length === 0],
  ...mustExist.map((f) => [`exists ${f}`, fs.existsSync(path.join(repo, f))]),
  ['customers select col', files.customersCols.includes("id: 'select'")],
  ['customers Actions header', files.customersCols.includes("t('Actions')")],
  [
    'customers pencil->update',
    files.customersActions.includes('Pencil') &&
      files.customersActions.includes("'update'"),
  ],
  [
    'customers sorting api',
    files.customersTable.includes('manualSorting') &&
      files.customersTable.includes('sort_by'),
  ],
  ['customers bulk', files.customersTable.includes('DataTableBulkActions')],
  ['edit ChannelPicker', files.customersEdit.includes('ChannelPicker')],
  [
    'edit upstream options',
    files.customersEdit.includes('getUpstreamModeOptions'),
  ],
  [
    'detail read-only upstream',
    !files.customersDetail.includes('updateUpstreamSettings'),
  ],
  ['ws select col', files.wsCols.includes("id: 'select'")],
  ['ws Actions header', files.wsCols.includes("t('Actions')")],
  [
    'ws pencil->update',
    files.wsActions.includes('Pencil') && files.wsActions.includes("'update'"),
  ],
  [
    'ws sorting',
    files.wsTable.includes('manualSorting') &&
      files.wsTable.includes('sorting'),
  ],
  // Members: Models-style tabs (not stacked dual tables)
  [
    'members tabs shell',
    files.membersPage.includes('Tabs') &&
      files.membersPage.includes('TabsTrigger') &&
      files.membersPage.includes("'/members/$section'"),
  ],
  [
    'members sections registry',
    files.membersRegistry.includes("id: 'members'") &&
      files.membersRegistry.includes("id: 'invitations'") &&
      files.membersRegistry.includes("urlStyle: 'path'"),
  ],
  [
    'members index redirects',
    files.membersIndex.includes("to: '/members/$section'") &&
      files.membersIndex.includes('MEMBERS_DEFAULT_SECTION'),
  ],
  [
    'members route search prefixes',
    files.membersRoute.includes('mFilter') &&
      files.membersRoute.includes('iFilter'),
  ],
  [
    'members table users-standard',
    files.membersTable.includes('manualSorting') &&
      files.membersTable.includes('enableRowSelection: true') &&
      files.membersCols.includes("id: 'select'") &&
      files.membersCols.includes("t('Actions')"),
  ],
  [
    'members no edit pencil',
    !files.membersActions.includes('Pencil') &&
      files.membersActions.includes("t('Remove')"),
  ],
  [
    'invite via drawer',
    files.membersInvite.includes('SheetTitle') &&
      files.membersInvite.includes("t('Create Invitation')") &&
      files.membersPage.includes('MembersInviteDrawer'),
  ],
  [
    'invitations table users-standard',
    files.invitationsTable.includes('manualSorting') &&
      files.invitationsTable.includes('enableRowSelection: true') &&
      files.invitationsCols.includes("id: 'select'") &&
      files.invitationsCols.includes("t('Actions')"),
  ],
  [
    'invitations no edit pencil',
    !files.invitationsActions.includes('Pencil') &&
      files.invitationsActions.includes("t('Copy link')") &&
      files.invitationsActions.includes("t('Revoke')"),
  ],
  [
    'sidebar members tab urls',
    files.sidebarData.includes("url: '/members/members'") &&
      files.sidebarData.includes("'/members/invitations'"),
  ],
  [
    'members tab not stacked',
    files.membersPage.includes('activeSection ===') &&
      files.membersPage.includes('Tabs') &&
      files.listStandard.includes('Tab') &&
      !files.listStandard.includes('上下双表'),
  ],
  // Upstream: Users-like DataTable
  [
    'upstream table users-standard',
    files.upstreamPage.includes('UpstreamTable') &&
      files.upstreamTable.includes('manualSorting') &&
      files.upstreamTable.includes('enableRowSelection: true') &&
      files.upstreamCols.includes("id: 'select'") &&
      files.upstreamCols.includes("t('Actions')"),
  ],
  [
    'upstream pencil->update',
    files.upstreamActions.includes('Pencil') &&
      files.upstreamActions.includes("'update'"),
  ],
  ['backend customerListOrder', files.customerGo.includes('customerListOrder')],
  ['binding ChannelName', files.bindingGo.includes('ChannelName')],
  [
    'attachChannelBindingNames',
    files.upstreamGo.includes('attachChannelBindingNames'),
  ],
]

let fail = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) fail += 1
}
if (missingEn.length) console.log('missing_en', missingEn)
if (missingZh.length) console.log('missing_zh', missingZh)
console.log(`summary_fail=${fail}`)
process.exit(fail ? 1 : 0)
