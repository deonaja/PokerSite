import { test, expect, chromium } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers } from './helpers'

async function forceEndAllSessions() {
  const sql = neon(process.env.DATABASE_URL!)
  await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
}

async function openRebuySheet(page: import('@playwright/test').Page, card: import('@playwright/test').Locator) {
  const sheetTitle = page.getByText(/Rebuy .*?\?/)
  for (let i = 0; i < 3; i++) {
    await card.getByRole('button', { name: 'Rebuy' }).click()
    if (await sheetTitle.isVisible()) return
  }
  await expect(sheetTitle).toBeVisible()
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
    // Top up balances + clear cooldown so Bob can afford 2 rebuys and Alice can deal
    await forceEndAllSessions()
    await resetTestPlayers(500)

    // ── SETUP: start a session via context A ──────────────────────────────────
    await setIdentity(pageA, alice)
    await pageA.goto('http://localhost:3000/session/setup')
    await clickLabelFor(pageA, alice.name)
    await clickLabelFor(pageA, bob.name)
    await pageA.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
    await pageA.getByRole('button', { name: 'Mulai' }).click()
    await expect
      .poll(() => new URL(pageA.url()).pathname, { timeout: 25000, intervals: [250, 500, 1000] })
      .toBe('/session')
    const sql = neon(process.env.DATABASE_URL!)
    let activeSessionId: string | null = null
    await expect.poll(async () => {
      const [row] = await sql`
        SELECT id FROM sessions WHERE status = 'active' LIMIT 1
      ` as Array<{ id: string }>
      activeSessionId = row?.id ?? null
      return activeSessionId
    }, { timeout: 20000, intervals: [250, 500, 1000] }).not.toBeNull()
    if (!activeSessionId) throw new Error('No active session found after setup')
    const [balanceBeforeRow] = await sql`
      SELECT balance FROM players WHERE id = ${bob.id} LIMIT 1
    ` as Array<{ balance: number | string }>
    const balanceBefore = Number(balanceBeforeRow?.balance ?? 0)

    // Read Bob's initial rebuy_count
    const bobCardSetup = pageA.locator('div').filter({
      has: pageA.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    const initialRebuyText = await bobCardSetup.getByText(/Rebuy: \d+/).innerText()
    expect(parseInt(initialRebuyText.replace('Rebuy: ', ''), 10)).toBe(0)

    // ── Context B also navigates to the active session ─────────────────────────
    await setIdentity(pageB, bob)
    await pageB.goto('http://localhost:3000/session', { waitUntil: 'domcontentloaded' })

    // ── CONCURRENT REBUY ─────────────────────────────────────────────────────
    // .last() picks the inner participant card div, not the outer container
    const bobCardA = pageA.locator('div').filter({
      has: pageA.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    const bobCardB = pageB.locator('div').filter({
      has: pageB.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    // Open rebuy sheet on both pages (retry handles pre-hydration dead-clicks)
    await openRebuySheet(pageA, bobCardA)
    await openRebuySheet(pageB, bobCardB)

    // Both confirm simultaneously
    await Promise.all([
      pageA.getByRole('button', { name: 'Rebuy' }).last().click(),
      pageB.getByRole('button', { name: 'Rebuy' }).last().click(),
    ])

    // Wait for each page's rebuy action to complete: router.refresh() updates the
    // participant card to a non-zero rebuy count. The Sheet uses CSS transforms so
    // Playwright never sees it as DOM-hidden — watch the data update instead.
    await expect.poll(async () => {
      const [row] = await sql`
        SELECT rebuy_count
        FROM session_participants
        WHERE session_id = ${activeSessionId}
          AND player_id = ${bob.id}
        LIMIT 1
      ` as Array<{ rebuy_count: number | string }>
      return Number(row?.rebuy_count ?? -1)
    }, { timeout: 20000, intervals: [250, 500, 1000] }).toBe(2)

    await expect.poll(async () => {
      const [row] = await sql`
        SELECT balance
        FROM players
        WHERE id = ${bob.id}
        LIMIT 1
      ` as Array<{ balance: number | string }>
      const currentBalance = Number(row?.balance ?? balanceBefore)
      return balanceBefore - currentBalance
    }, { timeout: 20000, intervals: [250, 500, 1000] }).toBe(200)

    // ── VERIFY: fresh server render shows rebuy_count = 2 ────────────────────
    await pageA.reload({ waitUntil: 'domcontentloaded' })
    await expect(pageA.getByText('Rebuy: 2')).toBeVisible({ timeout: 10000 })
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

  const { players } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  // Ensure no active session before racing + reset balances/cooldown
  await forceEndAllSessions().catch(() => {})
  await resetTestPlayers(500).catch(() => {})

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
    const statusOf = async (page: import('@playwright/test').Page): Promise<'success' | 'error' | 'pending'> => {
      const url = page.url()
      if (url.includes('/session') && !url.includes('/setup')) return 'success'
      if (await page.getByText('Sudah ada sesi aktif').isVisible()) return 'error'
      return 'pending'
    }

    await Promise.all([
      expect.poll(async () => statusOf(pageA), { timeout: 30000, intervals: [250, 500, 1000] }).not.toBe('pending'),
      expect.poll(async () => statusOf(pageB), { timeout: 30000, intervals: [250, 500, 1000] }).not.toBe('pending'),
    ])

    // Exactly one should succeed (redirect to /session), one should show error
    const aSuccess = (await statusOf(pageA)) === 'success'
    const bSuccess = (await statusOf(pageB)) === 'success'

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
