/*
Copyright (C) 2023-2026 QuantumNous

Static smoke for customer-experience-iteration P0–P3.
No running server / Go toolchain required.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(repo, rel))
}

const checks = []
function check(phase, name, cond) {
  checks.push({ phase, name, ok: Boolean(cond) })
}

// ===================== P0 =====================
const signUp = read('web/src/features/auth/sign-up/components/sign-up-form.tsx')
check(
  'P0',
  'signup chooser personal/organization',
  signUp.includes('Personal') &&
    signUp.includes('Organization') &&
    signUp.includes('setSignupOrgIntent')
)

const orgIntent = read('web/src/features/auth/lib/signup-org-intent.ts')
check(
  'P0',
  'signup org intent setup=organization',
  orgIntent.includes('setup=organization')
)

const signIn = read('web/src/features/auth/sign-in/components/user-auth-form.tsx')
check('P0', 'sign-in includes OAuthProviders', signIn.includes('OAuthProviders'))

const header = read('web/src/components/layout/components/app-header.tsx')
check(
  'P0',
  'header has no workspace switcher / customer context controls',
  !header.includes('WorkspaceSwitcher') &&
    !header.includes('WorkspaceSelect') &&
    !header.includes('CustomerContext')
)

const webFiles = [...fs.readdirSync(path.join(repo, 'web/src'), { recursive: true })].map(
  String
)
check(
  'P0',
  'WorkspaceContextBanner removed',
  !webFiles.some(
    (f) => f.includes('context-banner') || f.includes('WorkspaceContextBanner')
  )
)

const scopeLabel = read('web/src/features/keys/lib/token-scope-label.ts')
check(
  'P0',
  'token scope label CustomerName-WorkspaceName',
  scopeLabel.includes('`${customer}-${workspace}`')
)

const filters = read(
  'web/src/features/customer-org/components/org-scope-filters.tsx'
)
check(
  'P0',
  'org scope filters default ALL',
  filters.includes("ORG_FILTER_ALL = 'all'")
)

// ===================== P1 =====================
const quotaLimit = read('model/quota_limit.go')
check(
  'P1',
  'quota limit setters present',
  quotaLimit.includes('SetCustomerQuotaLimit') &&
    quotaLimit.includes('SetWorkspaceQuotaLimit')
)

const quotaRoute = read('web/src/routes/_authenticated/quota/index.tsx')
check(
  'P1',
  '/quota route redirects (retired)',
  quotaRoute.includes('redirect') &&
    (quotaRoute.includes('/workspaces') || quotaRoute.includes("'/workspaces'"))
)

const sidebar = read('web/src/hooks/use-sidebar-data.ts')
check(
  'P1',
  'sidebar has no /quota menu entry',
  !sidebar.includes("url: '/quota'") && !sidebar.includes('"/quota"')
)
check(
  'P1',
  'sidebar has org wallet entry /org-wallet',
  sidebar.includes("url: '/org-wallet'")
)

// ===================== P2 =====================
check('P2', 'organization wallet model', exists('model/organization_wallet.go'))
check(
  'P2',
  'organization wallet controller',
  exists('controller/organization_wallet.go')
)
check('P2', 'funding source service', exists('service/funding_source.go'))
const funding = read('service/funding_source.go')
check(
  'P2',
  'funding source references org wallet',
  /OrgWallet|organization.?wallet|WorkspaceFunding/i.test(funding)
)

check(
  'P2',
  'org wallet page + route',
  exists('web/src/features/customer-org/org-wallet-page.tsx') &&
    exists('web/src/routes/_authenticated/org-wallet/index.tsx')
)
check(
  'P2',
  'org-wallet in routeTree.gen.ts',
  read('web/src/routeTree.gen.ts').includes('org-wallet')
)
check(
  'P2',
  'members wallet allocate/revoke dialog',
  exists('web/src/features/customer-org/components/members-wallet-dialog.tsx')
)

const apiRouter = read('router/api-router.go')
check(
  'P2',
  'API wires org-wallet allocate/self',
  apiRouter.includes('org-wallet') &&
    apiRouter.includes('GetSelfOrgWallets') &&
    apiRouter.includes('AllocateOrgWallet')
)

// ===================== P3 =====================
const member = read('model/customer_member.go')
check(
  'P3',
  'ListUserCustomerMemberships + SetUserCurrentCustomer',
  member.includes('ListUserCustomerMemberships') &&
    member.includes('SetUserCurrentCustomer')
)

check(
  'P3',
  'current-customer API route',
  apiRouter.includes('current-customer') &&
    apiRouter.includes('SetCurrentCustomer')
)

const inviteOps = read('model/invitation_ops.go')
check(
  'P3',
  'invitation requires workspace_id',
  inviteOps.includes('ErrInvitationWorkspaceRequired')
)
check(
  'P3',
  'accept rejects same-customer member',
  inviteOps.includes('ErrAlreadyCustomerMember')
)

const customerModel = read('model/customer.go')
const createOwner = customerModel.slice(
  customerModel.indexOf('func CreateCustomerWithOwner'),
  customerModel.indexOf('func CreateCustomerWithOwner') + 2200
)
check(
  'P3',
  'CreateCustomerWithOwner does not block existing owners',
  !createOwner.includes('ErrOwnerAlreadyHasCustomer')
)

const selfTest = read('controller/customer_self_test.go')
check(
  'P3',
  'SelfCreateCustomer allows existing customer (test)',
  selfTest.includes('TestSelfCreateCustomerAllowsExistingCustomer')
)

const inviteDrawer = read(
  'web/src/features/customer-org/components/members-invite-drawer.tsx'
)
check(
  'P3',
  'invite drawer always sends workspace_id (no default omit)',
  !inviteDrawer.includes("workspace_id: 'default'") &&
    inviteDrawer.includes('Workspace is required') &&
    inviteDrawer.includes('workspace_id:')
)

check(
  'P3',
  'create organization drawer exists',
  exists(
    'web/src/features/customer-org/components/create-organization-drawer.tsx'
  )
)

const membersPage = read('web/src/features/customer-org/members-page.tsx')
check(
  'P3',
  'members page can switch current customer',
  membersPage.includes('useSetCurrentCustomer') ||
    membersPage.includes('setCurrentCustomer')
)

const types = read('web/src/features/customer-org/types.ts')
check('P3', 'SelfCustomerContext includes customers[]', types.includes('customers?:'))

const design = read('docs/design/customer-experience-iteration-design.md')
check(
  'P3',
  'design doc marks P0–P3 complete',
  /P0.?P3|P0–P3/.test(design) && /主体完成|完成/.test(design)
)

const inviteTest = read('model/invitation_ops_test.go')
check(
  'P3',
  'invitation tests cover workspace + multi-customer',
  inviteTest.includes('TestCreateInvitationRequiresWorkspace') &&
    inviteTest.includes('TestAcceptInvitationAllowsUserFromOtherCustomer')
)

// ===================== report =====================
const failed = checks.filter((c) => !c.ok)
const byPhase = {}
for (const c of checks) {
  byPhase[c.phase] ??= { pass: 0, fail: 0 }
  byPhase[c.phase][c.ok ? 'pass' : 'fail'] += 1
}

for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  [${c.phase}] ${c.name}`)
}
console.log('---')
for (const [phase, s] of Object.entries(byPhase)) {
  console.log(`${phase}: ${s.pass} passed, ${s.fail} failed`)
}
console.log(`TOTAL: ${checks.length - failed.length}/${checks.length} passed`)

if (failed.length) {
  console.error('\nFailed checks:')
  for (const f of failed) console.error(`  - [${f.phase}] ${f.name}`)
  process.exit(1)
}
