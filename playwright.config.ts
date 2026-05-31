import { defineConfig } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

// Isolate the suite on a dedicated DB when TEST_DATABASE_URL is set (e.g. a Neon
// branch), so tests never mutate the real dev DB (which holds the owner's actual
// players). When unset, fall back to DATABASE_URL — legacy behavior — and warn.
// Mutating process.env here (before globalSetup/webServer) propagates to the
// runner (global-setup, helpers) and the spawned dev server. @next/env and
// dotenv both leave already-set vars untouched, so .env.local won't clobber it.
const testDbUrl = process.env.TEST_DATABASE_URL
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl
  process.env.POSTGRES_URL = testDbUrl
} else {
  console.warn(
    '[playwright] TEST_DATABASE_URL not set — running against DATABASE_URL (the dev DB). ' +
      'Set TEST_DATABASE_URL to a Neon test branch in .env.local to isolate test data.'
  )
}

export default defineConfig({
  testDir: './tests',
  // Heavy season/session tests do many round-trips through the Neon serverless
  // driver; a cold/throttled free-tier DB can push them past 30s. 60s + one
  // retry keeps the suite reliable without masking real assertion failures.
  timeout: 60_000,
  retries: 1,
  workers: 1, // serial — tests share DB state
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Mobile viewport (iPhone SE size), Chromium engine
    viewport: { width: 375, height: 667 },
    browserName: 'chromium',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    // When isolating on a test branch, don't reuse a stray dev server that may
    // be wired to the real dev DB — spin up our own with the test env instead.
    reuseExistingServer: !testDbUrl,
    timeout: 60_000,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL } as Record<string, string>,
  },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  projects: [
    { name: 'mobile' },
  ],
})
