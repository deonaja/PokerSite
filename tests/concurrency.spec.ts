import { test, expect, chromium } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor } from './helpers'

async function forceEndAllSessions() {
  const sql = neon(process.env.DATABASE_URL!)
  await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
}

/**
 * Concurrency test: two users rebuy the same player simultaneously.
 * Expected: balance decreases by 200 total (2 × 100), rebuy_count = 2.
 * If there's a race condition: balance only decreases by 100, rebuy_count = 1.
 */
test('concurrent rebuys on same player apply both correctly', async () => {
  test.setTimeout(90_000)

  const { players } = getTestData()
  const alice = players[0] // dealer — won't pay buy-in
  const bob = players[1]   // non-dealer — pays buy-in

  const browser = await chromium.launch()

  const ctxA = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageA = await ctxA.newPage()
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageB = await ctxB.newPage()

  // Cap each action so slow operations fail fast rather than eating the test timeout
  pageA.setDefaultTimeout(20000)
  pageB.setDefaultTimeout(20000)

  try {
    // ── SETUP: start a session via context A ──────────────────────────────────
    await setIdentity(pageA, alice)
    await pageA.goto('http://localhost:3000/session/setup')
    await clickLabelFor(pageA, alice.name)
    await clickLabelFor(pageA, bob.name)
    await pageA.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
    await pageA.getByRole('button', { name: 'Mulai' }).click()
    // waitForURL fires on URL change; waitForLoadState ensures HTML is actually rendered
    await pageA.waitForURL('**/session', { timeout: 25000 })
    await pageA.waitForLoadState('domcontentloaded')

    // Read Bob's initial rebuy_count
    const bobCardSetup = pageA.locator('div').filter({
      has: pageA.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    const initialRebuyText = await bobCardSetup.getByText(/Rebuy: \d+/).innerText()
    expect(parseInt(initialRebuyText.replace('Rebuy: ', ''), 10)).toBe(0)

    // ── Context B also navigates to the active session ─────────────────────────
    await setIdentity(pageB, bob)
    await pageB.goto('http://localhost:3000/session')
    await pageB.waitForLoadState('domcontentloaded')

    // ── CONCURRENT REBUY ─────────────────────────────────────────────────────
    // .last() picks the inner participant card div, not the outer container
    const bobCardA = pageA.locator('div').filter({
      has: pageA.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    const bobCardB = pageB.locator('div').filter({
      has: pageB.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    // Both open the rebuy sheet
    await Promise.all([
      bobCardA.getByRole('button', { name: 'Rebuy' }).click(),
      bobCardB.getByRole('button', { name: 'Rebuy' }).click(),
    ])

    // Wait for both sheets to open before confirming
    await Promise.all([
      pageA.getByText('Balance kepotong 100').waitFor({ state: 'visible', timeout: 15000 }),
      pageB.getByText('Balance kepotong 100').waitFor({ state: 'visible', timeout: 15000 }),
    ])

    // Both confirm simultaneously
    await Promise.all([
      pageA.getByRole('button', { name: 'Rebuy' }).last().click(),
      pageB.getByRole('button', { name: 'Rebuy' }).last().click(),
    ])

    // Wait for each page's rebuy action to complete: router.refresh() updates the
    // participant card to a non-zero rebuy count. The Sheet uses CSS transforms so
    // Playwright never sees it as DOM-hidden — watch the data update instead.
    await Promise.all([
      expect(bobCardA.getByText(/Rebuy: [1-9]/)).toBeVisible({ timeout: 20000 }),
      expect(bobCardB.getByText(/Rebuy: [1-9]/)).toBeVisible({ timeout: 20000 }),
    ])

    // ── VERIFY: fresh server render shows rebuy_count = 2 ────────────────────
    await pageA.goto('http://localhost:3000/session')
    await pageA.waitForLoadState('domcontentloaded')
    const updatedBobCard = pageA.locator('div').filter({
      has: pageA.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    await expect(updatedBobCard.getByText('Rebuy: 2')).toBeVisible({ timeout: 10000 })
  } finally {
    await forceEndAllSessions().catch(() => {})
    await ctxA.close()
    await ctxB.close()
    await browser.close()
  }
})

/**
 * Concurrency test: two users try to start a session at the same time.
 * Expected: only one session starts, the other gets an error.
 */
test('concurrent startSession: only one succeeds', async () => {
  test.setTimeout(90_000)

  const { players, adminKey } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  // Ensure no active session before racing
  await forceEndAllSessions().catch(() => {})

  const browser = await chromium.launch()
  const ctxA = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  pageA.setDefaultTimeout(20000)
  pageB.setDefaultTimeout(20000)

  try {
    // Both pages go to session setup
    await setIdentity(pageA, alice)
    await setIdentity(pageB, bob)

    await pageA.goto('http://localhost:3000/session/setup')
    await pageB.goto('http://localhost:3000/session/setup')

    // Both select players and dealer
    await clickLabelFor(pageA, alice.name)
    await clickLabelFor(pageA, bob.name)
    await pageA.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()

    await clickLabelFor(pageB, alice.name)
    await clickLabelFor(pageB, charlie.name)
    await pageB.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()

    // Submit simultaneously
    await Promise.all([
      pageA.getByRole('button', { name: 'Mulai' }).click(),
      pageB.getByRole('button', { name: 'Mulai' }).click(),
    ])

    // Wait for each page to reach a stable state: redirect to /session OR show the
    // "already active" error. A fixed sleep isn't reliable in dev mode — the
    // router.push('/session') navigation can take longer than a hard-coded wait.
    await Promise.all([
      Promise.race([
        pageA.waitForURL('**/session', { timeout: 30000 }),
        pageA.getByText('Sudah ada sesi aktif').waitFor({ state: 'visible', timeout: 30000 }),
      ]),
      Promise.race([
        pageB.waitForURL('**/session', { timeout: 30000 }),
        pageB.getByText('Sudah ada sesi aktif').waitFor({ state: 'visible', timeout: 30000 }),
      ]),
    ])

    // Exactly one should succeed (redirect to /session), one should show error
    const aSuccess = pageA.url().includes('/session') && !pageA.url().includes('/setup')
    const bSuccess = pageB.url().includes('/session') && !pageB.url().includes('/setup')

    // Exactly one should have succeeded
    expect(aSuccess !== bSuccess).toBe(true)

    // The failing one should show an error message
    const failingPage = aSuccess ? pageB : pageA
    await expect(failingPage.getByText('Sudah ada sesi aktif')).toBeVisible()
  } finally {
    await forceEndAllSessions().catch(() => {})
    await ctxA.close()
    await ctxB.close()
    await browser.close()
  }
})
