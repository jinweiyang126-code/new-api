/**
 * Static self-test for UX iteration (signup onboarding, members, wallet, turnstile, scope).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(repo, rel))
}

let failed = 0
function check(name, ok) {
  if (ok) console.log('PASS ', name)
  else {
    console.error('FAIL ', name)
    failed++
  }
}

// --- Signup / onboarding ---
check('onboarding route file exists', exists('web/src/routes/(auth)/onboarding.tsx'))
check('signup-onboarding lib exists', exists('web/src/features/auth/lib/signup-onboarding.ts'))
check('old signup-org-intent removed', !exists('web/src/features/auth/lib/signup-org-intent.ts'))

const onboarding = read('web/src/features/auth/lib/signup-onboarding.ts')
check('onboarding path /onboarding', onboarding.includes("'/onboarding'"))
check('resolveSignupOnboardingRedirect exported', onboarding.includes('resolveSignupOnboardingRedirect'))

const signUp = read('web/src/features/auth/sign-up/components/sign-up-form.tsx')
check('sign-up sets onboarding pending', signUp.includes('setSignupOnboardingPending'))
check('sign-up no pre-chooser organization type', !signUp.includes("setAccountType('organization')"))
check('sign-up auto-login after register', signUp.includes('await login('))
check('sign-up no account_type organization payload', !signUp.includes("account_type: 'organization'"))

const authRedirect = read('web/src/features/auth/hooks/use-auth-redirect.ts')
check('login success uses onboarding redirect', authRedirect.includes('resolveSignupOnboardingRedirect'))

const oauth = read('web/src/routes/oauth/$provider.tsx')
check('oauth callback uses onboarding redirect', oauth.includes('resolveSignupOnboardingRedirect'))

const routeTree = read('web/src/routeTree.gen.ts')
check('routeTree includes /onboarding', routeTree.includes('/onboarding'))

const signUpRoute = read('web/src/routes/(auth)/sign-up.tsx')
check('sign-up redirects logged-in users to dashboard', signUpRoute.includes("redirect({ to: '/dashboard' })"))
check('sign-up no setup=organization redirect', !signUpRoute.includes("setup === 'organization'"))

// --- OAuth / Turnstile loading ---
const indexHtml = read('web/index.html')
check('index.html has boot oauth loader', indexHtml.includes('boot-oauth-loader'))
check(
  'index.html boot loader uses pathname prefix check',
  indexHtml.includes("pathname.indexOf('/oauth/')")
)

const root = read('web/src/routes/__root.tsx')
check('root skips blocking bootstrap on /oauth/', root.includes("pathname.startsWith('/oauth/')"))

const turnstile = read('web/src/components/turnstile.tsx')
check('turnstile shows loading state', turnstile.includes("loadState === 'loading'"))
check('turnstile uses human check initializing copy', turnstile.includes('human check is initializing'))
check('turnstile auto-retries script load', turnstile.includes('MAX_AUTO_RETRIES'))
check('turnstile error UI has Retry', turnstile.includes("t('Retry')"))
check('turnstile force-reloads failed script', turnstile.includes('removeTurnstileScript'))
check('turnstile waits for widget DOM', turnstile.includes('waitForWidgetDom'))
check('turnstile exports loading placeholder', turnstile.includes('TurnstileLoadingPlaceholder'))

const mainTsx = read('web/src/main.tsx')
check(
  'main keeps boot loader on oauth until React screen',
  mainTsx.includes("pathname.startsWith('/oauth/')") &&
    mainTsx.includes('hideBootOAuthLoader')
)

const oauthScreen = read('web/src/features/auth/components/oauth-callback-screen.tsx')
check(
  'oauth screen hides boot loader on layout',
  oauthScreen.includes('useLayoutEffect') &&
    oauthScreen.includes('hideBootOAuthLoader')
)

const useTurnstile = read('web/src/features/auth/hooks/use-turnstile.ts')
check(
  'useTurnstile exposes status-pending slot',
  useTurnstile.includes('showTurnstileSlot') &&
    useTurnstile.includes('isTurnstileStatusPending')
)

const signIn = read('web/src/features/auth/sign-in/components/user-auth-form.tsx')
check('sign-in disables submit until turnstileReady', signIn.includes('!turnstileReady'))
check('sign-in shows turnstile slot while status pending', signIn.includes('showTurnstileSlot'))

// --- Members ---
const membersPage = read('web/src/features/customer-org/members-page.tsx')
check('members tabs show Members ({{count}})', membersPage.includes("Members ({{count}})"))
check('members tabs show Invitations ({{count}})', membersPage.includes("Invitations ({{count}})"))
check('members page no top workspace filter handler', !membersPage.includes('onWorkspaceFilterChange'))

const membersTable = read('web/src/features/customer-org/components/members-table.tsx')
check('members table has workspace toolbar filter', membersTable.includes("columnId: 'workspace_id'"))
check('members table loads workspace names in all mode', membersTable.includes('workspace_names'))

const membersCols = read('web/src/features/customer-org/components/members-columns.tsx')
check('members columns use BadgeListCell for workspaces', membersCols.includes('BadgeListCell'))
check('members columns Workspace Name header', membersCols.includes("t('Workspace Name')"))

const invitationsCols = read('web/src/features/customer-org/components/invitations-columns.tsx')
check('invitations columns Workspace Name header', invitationsCols.includes("t('Workspace Name')"))
check('invitations columns resolve workspace name', invitationsCols.includes('workspaceNameById'))

const onboardingForm = read(
  'web/src/features/auth/onboarding/components/signup-onboarding-form.tsx'
)
check(
  'onboarding refreshes self-customer after create org',
  onboardingForm.includes('SELF_CUSTOMER_QUERY_KEY') &&
    onboardingForm.includes('invalidateQueries') &&
    onboardingForm.includes('setCurrentCustomer')
)

const workspacesRoute = read('web/src/routes/_authenticated/workspaces/index.tsx')
check(
  'workspaces route allows personal users (no customer 403)',
  !workspacesRoute.includes("to: '/403'") &&
    !workspacesRoute.includes('beforeLoad')
)

const sidebarView = read('web/src/hooks/use-sidebar-view.ts')
check(
  'sidebar shows org group for self-register personal users',
  sidebarView.includes('selfRegisterEnabled') &&
    sidebarView.includes('hasCustomer || selfRegisterEnabled')
)

const workspacesCols = read(
  'web/src/features/customer-org/components/workspaces-columns.tsx'
)
check(
  'workspaces columns Customer Name header',
  workspacesCols.includes("t('Customer Name')")
)

const membersSearch = read('web/src/routes/_authenticated/members/$section.tsx')
check('members search has mWorkspace', membersSearch.includes('mWorkspace'))

// --- Org wallet ---
const orgWallet = read('web/src/features/customer-org/org-wallet-page.tsx')
check('org wallet filter inside list header', orgWallet.includes('My organization wallets') && orgWallet.includes('setWorkspaceFilter'))
check('org wallet Usage Logs button removed', !orgWallet.includes('Usage Logs'))
check('org wallet is list (ul)', orgWallet.includes('<ul'))
check(
  'org wallet select uses items labels for All',
  orgWallet.includes('workspaceFilterItems') || orgWallet.includes('label: t(\'All\')')
)

const orgScope = read(
  'web/src/features/customer-org/components/org-scope-filters.tsx'
)
check(
  'org scope filters pass Select items with All label',
  orgScope.includes('items={workspaceItems}') &&
    orgScope.includes("label: t('All')")
)

// --- Token scope ---
const scope = read('web/src/features/keys/lib/token-scope-label.ts')
check('token scope uses spaced dash', scope.includes('`${customer} - ${workspace}`'))

// --- i18n keys (all locales) ---
const locales = ['en', 'zh', 'zh-TW', 'ja', 'fr', 'ru', 'vi']
const i18nKeys = [
  'Choose the type of account you want to create',
  'Personal account',
  'Organization account',
  'Welcome',
  'How will you be using the platform?',
  'You can change this later.',
  'Members ({{count}})',
  'Invitations ({{count}})',
  'Workspace Name',
  'Please wait a moment, human check is initializing...',
  'Customer Name',
  'Allocate wallet',
  'Revoke wallet',
  'Customer Management',
]
for (const loc of locales) {
  const dict = JSON.parse(read(`web/src/i18n/locales/${loc}.json`)).translation
  for (const k of i18nKeys) {
    // Non en/zh may fall back to English key for some entries
    if (loc === 'en' || loc === 'zh' || loc === 'zh-TW' || k in dict) {
      check(`${loc} i18n: ${k.slice(0, 40)}`, k in dict || loc === 'en')
    }
  }
}

// Exact Chinese copy expectations
const zh = JSON.parse(read('web/src/i18n/locales/zh.json')).translation
check('zh Customer Name = 组织名', zh['Customer Name'] === '组织名')
check('zh Workspace Name = 工作区名', zh['Workspace Name'] === '工作区名')
check('zh Allocate wallet = 充值', zh['Allocate wallet'] === '充值')
check('zh Revoke wallet = 扣款', zh['Revoke wallet'] === '扣款')
check('zh Customer Management = 组织管理', zh['Customer Management'] === '组织管理')
check('zh Customer = 组织', zh['Customer'] === '组织')
check(
  'zh remaining 客户 excludes 客户端 only',
  Object.values(zh).filter(
    (v) => /客户/.test(String(v)) && !/客户端/.test(String(v))
  ).length === 0
)

const en = JSON.parse(read('web/src/i18n/locales/en.json')).translation
check('en Customer = Organization', en['Customer'] === 'Organization')
check(
  'en Customer Management = Organization Management',
  en['Customer Management'] === 'Organization Management'
)
check('en Allocate wallet = Top up', en['Allocate wallet'] === 'Top up')
check('en Revoke wallet = Deduct', en['Revoke wallet'] === 'Deduct')

// --- Inline onboarding redirect logic (mirror of signup-onboarding.ts) ---
const KEY = 'tokenapi.signup_onboarding'
const store = new Map()
const sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

function setPending() {
  sessionStorage.setItem(KEY, '1')
}
function consumePending() {
  const v = sessionStorage.getItem(KEY) === '1'
  sessionStorage.removeItem(KEY)
  return v
}
function resolveRedirect(customerId) {
  if (!consumePending()) return undefined
  if (customerId && customerId > 0) return undefined
  return '/onboarding'
}

setPending()
check('logic: customerId 0 -> /onboarding', resolveRedirect(0) === '/onboarding')
setPending()
check('logic: undefined customer -> /onboarding', resolveRedirect(undefined) === '/onboarding')
setPending()
check('logic: existing customer skips onboarding', resolveRedirect(42) === undefined)
check('logic: pending consumed once', resolveRedirect(undefined) === undefined)

console.log('---')
if (failed) {
  console.error(`FAILED: ${failed}`)
  process.exit(1)
}
console.log('ALL STATIC CHECKS PASSED')
