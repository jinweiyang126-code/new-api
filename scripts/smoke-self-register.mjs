/*
Copyright (C) 2023-2026 QuantumNous
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8')
}

function loadLocale(file) {
  const json = JSON.parse(
    fs.readFileSync(path.join(repo, 'web/src', file), 'utf8')
  )
  return json.translation || json
}

const en = loadLocale('i18n/locales/en.json')
const zh = loadLocale('i18n/locales/zh.json')

const keys = [
  'Personal',
  'Organization',
  'Organization name',
  'Organization created',
  'Enter your organization name',
  'Invite teammates (optional)',
  'Add another email',
  'Please enter your organization name',
  'Set up your organization',
  'Customer self-register',
  'Allow users to self-register an organization',
  'Next',
  'Back',
  'Create account',
]

const missingEn = keys.filter((k) => !(k in en))
const missingZh = keys.filter((k) => !(k in zh))

const mustExist = [
  'controller/customer_self.go',
  'controller/customer_self_test.go',
  'web/src/features/auth/lib/signup-onboarding.ts',
  'web/src/features/auth/lib/signup-onboarding.test.ts',
  'web/src/routes/(auth)/onboarding.tsx',
  'web/src/features/auth/sign-up/components/organization-setup-fields.tsx',
  'web/src/features/auth/sign-up/components/sign-up-form.tsx',
  'web/src/routes/(auth)/sign-up.tsx',
  'docs/design/customer-self-register-design.md',
]

const missingFiles = mustExist.filter(
  (rel) => !fs.existsSync(path.join(repo, rel))
)

const router = read('router/api-router.go')
const userGo = read('controller/user.go')
const misc = read('controller/misc.go')
const constants = read('common/constants.go')
const option = read('model/option.go')
const signUpForm = read(
  'web/src/features/auth/sign-up/components/sign-up-form.tsx'
)
const oauth = read('web/src/routes/oauth/$provider.tsx')
const authRedirect = read('web/src/features/auth/hooks/use-auth-redirect.ts')
const customerApi = read('web/src/features/customer-org/api.ts')
const settings = read(
  'web/src/features/system-settings/auth/basic-auth-section.tsx'
)

const checks = [
  [
    'POST /customers/self is registered',
    router.includes('POST("/self", controller.SelfCreateCustomer)'),
  ],
  [
    'Register accepts organization account_type',
    userGo.includes('AccountType') &&
      userGo.includes('organization') &&
      userGo.includes('provisionSelfServiceCustomer'),
  ],
  [
    'status exposes customer_self_register_enabled',
    misc.includes('customer_self_register_enabled') &&
      misc.includes('CustomerSelfRegisterEnabled'),
  ],
  [
    'CustomerSelfRegisterEnabled defaults true',
    constants.includes('CustomerSelfRegisterEnabled = true'),
  ],
  [
    'option map wires CustomerSelfRegisterEnabled',
    option.includes('CustomerSelfRegisterEnabled'),
  ],
  [
    'sign-up form sets onboarding pending',
    signUpForm.includes('setSignupOnboardingPending') &&
      signUpForm.includes('login('),
  ],
  [
    'onboarding form creates organization',
    read('web/src/features/auth/onboarding/components/signup-onboarding-form.tsx').includes(
      'createSelfCustomer'
    ),
  ],
  [
    'oauth callback resolves onboarding redirect',
    oauth.includes('resolveSignupOnboardingRedirect'),
  ],
  [
    'login success resolves onboarding redirect',
    authRedirect.includes('resolveSignupOnboardingRedirect'),
  ],
  [
    'frontend API has createSelfCustomer',
    customerApi.includes("'/api/customers/self'"),
  ],
  [
    'settings has CustomerSelfRegisterEnabled switch',
    settings.includes('CustomerSelfRegisterEnabled'),
  ],
]

const failedChecks = checks.filter(([, ok]) => !ok).map(([name]) => name)

let failed = false
if (missingFiles.length) {
  failed = true
  console.error('Missing files:', missingFiles.join(', '))
}
if (missingEn.length) {
  failed = true
  console.error('Missing en i18n keys:', missingEn.join(', '))
}
if (missingZh.length) {
  failed = true
  console.error('Missing zh i18n keys:', missingZh.join(', '))
}
if (failedChecks.length) {
  failed = true
  console.error('Failed checks:', failedChecks.join(', '))
}

if (failed) {
  process.exit(1)
}

console.log('self-register smoke checks passed')
