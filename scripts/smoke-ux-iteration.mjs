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

const root = read('web/src/routes/__root.tsx')
check('root skips blocking bootstrap on /oauth/', root.includes("pathname.startsWith('/oauth/')"))

const turnstile = read('web/src/components/turnstile.tsx')
check('turnstile shows loading state', turnstile.includes("loadState === 'loading'"))
check('turnstile uses human check initializing copy', turnstile.includes('human check is initializing'))

const signIn = read('web/src/features/auth/sign-in/components/user-auth-form.tsx')
check('sign-in disables submit until turnstileReady', signIn.includes('!turnstileReady'))

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
check('members columns Workspace Name header', membersCols.includes('Workspace Name'))

const membersSearch = read('web/src/routes/_authenticated/members/$section.tsx')
check('members search has mWorkspace', membersSearch.includes('mWorkspace'))

// --- Org wallet ---
const orgWallet = read('web/src/features/customer-org/org-wallet-page.tsx')
check('org wallet filter inside list header', orgWallet.includes('My organization wallets') && orgWallet.includes('setWorkspaceFilter'))
check('org wallet Usage Logs button removed', !orgWallet.includes('Usage Logs'))
check('org wallet is list (ul)', orgWallet.includes('<ul'))

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
]
for (const loc of locales) {
  const zh = JSON.parse(read(`web/src/i18n/locales/${loc}.json`)).translation
  for (const k of i18nKeys) {
    check(`${loc} i18n: ${k.slice(0, 40)}`, k in zh)
  }
}

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
