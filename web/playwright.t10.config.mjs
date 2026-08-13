import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: 't10-smoke.spec.mjs',
  timeout: 120000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    baseURL: process.env.T10_BASE_URL || 'http://localhost:3000',
  },
  reporter: [['list']],
})
