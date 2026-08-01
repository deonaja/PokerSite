import { defineConfig } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

// Isolate the suite on a dedicated DB (e.g. a Neon branch) so tests never mutate
// the real dev DB, which holds the owner's actual players and balances.
//
// This is a HARD requirement, not a warning. The suite destroys data by design —
// it ends active sessions, rewrites balances, and drives the login throttle until
// accounts lock. The previous behavior (warn, then silently fall back to
// DATABASE_URL) meant one unset env var was all that stood between `pnpm test`
// and locking real players out of their own game. A log line is not a guardrail.
//
// Mutating process.env here (before globalSetup/webServer) propagates to the
// runner (global-setup, helpers) and the spawned dev server. @next/env and
// dotenv both leave already-set vars untouched, so .env.local won't clobber it.
const testDbUrl = process.env.TEST_DATABASE_URL
if (!testDbUrl) {
  throw new Error(
    '[playwright] TEST_DATABASE_URL is required — refusing to run against the dev DB.\n' +
      'This suite mutates balances and locks accounts. Point it at a throwaway database:\n' +
      '  Neon console → project → Branches → New Branch\n' +
      '  then set TEST_DATABASE_URL="<branch connection string>" in .env.local'
  )
}
process.env.DATABASE_URL = testDbUrl
process.env.POSTGRES_URL = testDbUrl

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
    // Never reuse a stray dev server — it may be wired to the real dev DB.
    // Always spin up our own with the test env. (Previously `!testDbUrl`, which
    // is now always false since an unset TEST_DATABASE_URL throws above.)
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL } as Record<string, string>,
  },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  projects: [
    { name: 'mobile' },
  ],
})
