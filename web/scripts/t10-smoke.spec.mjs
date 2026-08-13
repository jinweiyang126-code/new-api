import { test, expect } from '@playwright/test'

const BASE = process.env.T10_BASE_URL || 'http://localhost:3000'
const ROOT_USER = process.env.T10_USER || 'root'
const ROOT_PASS = process.env.T10_PASS || 'TestRoot1'
const OWNER_ID = process.env.T10_OWNER_ID || '2'
const CHANNEL_ID = process.env.T10_CHANNEL_ID || '1'
const CUSTOMER_NAME = `T10 Smoke ${Date.now()}`

test('T10 customer management smoke', async ({ page }) => {
  page.setDefaultTimeout(25000)
  const results = []

  await page.goto(`${BASE}/sign-in`)
  await page.locator('input[name="username"]').fill(ROOT_USER)
  await page.locator('input[name="password"], input[type="password"]').first().fill(ROOT_PASS)
  await page.getByRole('button', { name: /sign in|登录/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('sign-in'), {
    timeout: 30000,
  })
  results.push('PASS login')

  await page.goto(`${BASE}/customers`)
  const createBtn = page.getByRole('button', {
    name: /create customer|创建客户/i,
  })
  await expect(createBtn).toBeVisible()
  results.push('PASS customers page')

  await createBtn.click()
  const drawer = page.locator('[data-slot="sheet-content"], [role="dialog"]').last()
  await expect(drawer.getByText(/create customer|创建客户/i).first()).toBeVisible()

  // Fill by order inside the create form (labels may not be htmlFor-linked)
  const inputs = drawer.locator('input')
  await inputs.nth(0).fill(CUSTOMER_NAME) // name
  await inputs.nth(1).fill('') // slug optional — clear any placeholder fill
  await inputs.nth(2).fill(OWNER_ID) // owner_user_id

  const createResp = page.waitForResponse(
    (r) =>
      r.url().includes('/api/customers') &&
      r.request().method() === 'POST' &&
      r.status() < 500,
    { timeout: 30000 }
  )
  await drawer.getByRole('button', { name: /^create$|^创建$/i }).click()
  const resp = await createResp
  const body = await resp.json()
  expect(body.success, JSON.stringify(body)).toBeTruthy()
  results.push('PASS create customer API')

  // Detail drawer should open with default workspace
  await expect(
    page.getByText(/default workspace|默认工作区|Workspaces|工作区/i).first()
  ).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/\bdefault\b/).first()).toBeVisible()
  results.push('PASS default workspace visible')

  // Upstream settings
  const detail = page.locator('[data-slot="sheet-content"], [role="dialog"]').last()
  // Mode select trigger
  const modeTrigger = detail.locator('button').filter({ hasText: /shared|dedicated|byok|hybrid/i }).first()
  await modeTrigger.click()
  await page.getByRole('option', { name: 'dedicated' }).click()
  await detail.getByText(/enable byok|启用 BYOK|开启 BYOK/i).click()

  const upstreamResp = page.waitForResponse(
    (r) =>
      r.url().includes('/upstream-settings') &&
      r.request().method() === 'PUT',
    { timeout: 20000 }
  )
  await detail
    .getByRole('button', { name: /save upstream settings|保存上游设置/i })
    .click()
  const up = await (await upstreamResp).json()
  expect(up.success, JSON.stringify(up)).toBeTruthy()
  results.push('PASS upstream settings')

  // Channel binding
  await detail.getByPlaceholder(/channel id|渠道 ID|渠道/i).fill(CHANNEL_ID)
  await detail.getByPlaceholder(/priority|优先级/i).fill('10')
  const bindResp = page.waitForResponse(
    (r) =>
      r.url().includes('/channel-bindings') &&
      r.request().method() === 'POST',
    { timeout: 20000 }
  )
  await detail.getByRole('button', { name: /^add$|^添加$/i }).click()
  const bind = await (await bindResp).json()
  expect(bind.success, JSON.stringify(bind)).toBeTruthy()
  await expect(detail.getByText(new RegExp(`#${CHANNEL_ID}`))).toBeVisible()
  results.push('PASS channel binding')

  // Sheet close is flaky under Playwright (devtools overlay); reload list instead.
  await page.goto(`${BASE}/customers`)
  await expect(
    page.getByRole('button', { name: /create customer|创建客户/i })
  ).toBeVisible()
  results.push('PASS return to customers list')

  // Top up
  const row = page.getByRole('row').filter({ hasText: CUSTOMER_NAME })
  await expect(row).toBeVisible()
  await row.getByRole('button').last().click()
  await page.getByRole('menuitem', { name: /top up|充值/i }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: /top up|充值/i })
  await dialog.locator('input[type="number"]').fill('1')
  const topupResp = page.waitForResponse(
    (r) => r.url().includes('/topup') && r.request().method() === 'POST',
    { timeout: 20000 }
  )
  await dialog.getByRole('button', { name: /confirm|确认/i }).click()
  const top = await (await topupResp).json()
  expect(top.success, JSON.stringify(top)).toBeTruthy()
  results.push('PASS top up')

  // Disable
  await row.getByRole('button').last().click()
  const disableResp = page.waitForResponse(
    (r) =>
      r.url().includes('/api/customers/') &&
      r.request().method() === 'PUT',
    { timeout: 20000 }
  )
  await page.getByRole('menuitem', { name: /disable|停用/i }).click()
  const dis = await (await disableResp).json()
  expect(dis.success, JSON.stringify(dis)).toBeTruthy()
  results.push('PASS disable')

  console.log('\n=== T10 SMOKE RESULTS ===')
  for (const line of results) console.log(line)
  console.log('CUSTOMER_NAME=', CUSTOMER_NAME)
})
