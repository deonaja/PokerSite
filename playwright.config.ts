import { defineConfig } from '@playwright/test'

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
    reuseExistingServer: true,
    timeout: 60_000,
  },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  projects: [
    { name: 'mobile' },
  ],
})
