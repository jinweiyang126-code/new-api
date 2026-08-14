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
]

const missingEn = keys.filter((k) => !(k in en))
const missingZh = keys.filter((k) => !(k in zh))

const mustExist = [
  'web/src/features/customers/components/channel-picker.tsx',
  'web/src/features/customers/components/customers-edit-drawer.tsx',
  'web/src/features/customers/components/data-table-bulk-actions.tsx',
  'web/src/features/customer-org/components/workspaces-bulk-actions.tsx',
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
  members: read('web/src/features/customer-org/members-page.tsx'),
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
  [
    'invite button aligned',
    files.members.includes('items-end') &&
      files.members.includes("t('Create Invitation')") &&
      !files.members.includes('invisible'),
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
