import { test, expect, chromium } from '@playwright/test'
import { getTestData, setIdentity, clickLabelFor } from './helpers'

/**
 * Concurrency test: two users rebuy the same player simultaneously.
 * Expected: balance decreases by 200 total (2 × 100), rebuy_count = 2.
 * If there's a race condition: balance only decreases by 100, rebuy_count = 1.
 */
test('concurrent rebuys on same player apply both correctly', async () => {
  const { players, adminKey } = getTestData()
  const alice = players[0] // dealer — won't pay buy-in
  const bob = players[1]   // non-dealer — pays buy-in

  const browser = await chromium.launch()

  // Context A: Alice is the actor
  const ctxA = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageA = await ctxA.newPage()

  // Context B: Bob is the actor
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageB = await ctxB.newPage()

  try {
    // ── SETUP: start a session via context A ──────────────────────────────────
    await setIdentity(pageA, alice)
    await pageA.goto('http://localhost:3000/session/setup')
    await clickLabelFor(pageA, alice.name)
    await clickLabelFor(pageA, bob.name)
    await pageA.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
    await pageA.getByRole('button', { name: 'Mulai' }).click()
    await pageA.waitForURL('**/session')

    // Read Bob's current rebuy_count from the page
    const bobSection = pageA.locator('div').filter({ hasText: bob.name }).last()
    const initialRebuyText = await bobSection.getByText(/Rebuy: \d+/).innerText()
    const initialRebuy = parseInt(initialRebuyText.replace('Rebuy: ', ''), 10)
    expect(initialRebuy).toBe(0)

    // ── Context B also navigates to the active session ─────────────────────────
    await setIdentity(pageB, bob)
    await pageB.goto('http://localhost:3000/session')

    // ── CONCURRENT REBUY ─────────────────────────────────────────────────────
    // Both open the sheet for Bob at the same time
    const bobSectionA = pageA.locator('div').filter({ hasText: bob.name }).last()
    const bobSectionB = pageB.locator('div').filter({ hasText: bob.name }).last()

    await Promise.all([
      bobSectionA.getByRole('button', { name: 'Rebuy' }).click(),
      bobSectionB.getByRole('button', { name: 'Rebuy' }).click(),
    ])

    // Both confirm the rebuy simultaneously
    await Promise.all([
      pageA.getByRole('button', { name: 'Rebuy' }).last().click(),
      pageB.getByRole('button', { name: 'Rebuy' }).last().click(),
    ])

    // Wait for both pages to settle
    await pageA.waitForTimeout(2000)
    await pageB.waitForTimeout(2000)

    // ── VERIFY: rebuy_count should be 2 ──────────────────────────────────────
    // Poll will update the UI — check via the admin page for the ground truth
    await pageA.goto(`http://localhost:3000/admin?key=${adminKey}`)
    await pageA.waitForURL('**/admin')

    // Bob's balance: started 500, paid buy-in 100 → 400, 2 rebuys → 200
    const expectedBalance = bob.balance - 100 - 200 // = 200
    await expect(pageA.getByText(bob.name)).toBeVisible()

    // Navigate to session page to check rebuy_count
    await pageA.goto('http://localhost:3000/session')
    const updatedBobSection = pageA.locator('div').filter({ hasText: bob.name }).last()
    await expect(updatedBobSection.getByText('Rebuy: 2')).toBeVisible({ timeout: 5000 })

    // Verify via admin: balance reflects both rebuys
    await pageA.goto(`http://localhost:3000/admin`)
    const balanceText = pageA.locator('div').filter({ hasText: bob.name }).locator('span').last()
    await expect(balanceText).toContainText(String(expectedBalance))

    // ── CLEANUP: force-end the session ────────────────────────────────────────
    await pageA.goto('http://localhost:3000/admin')
    const forceEndBtn = pageA.getByRole('button', { name: 'Force-end sesi' })
    if (await forceEndBtn.isVisible()) {
      await forceEndBtn.click()
      await pageA.getByRole('button', { name: 'Yakin force-end' }).click()
      await expect(pageA.getByText('Sesi di-force-end.')).toBeVisible()
    }
  } finally {
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
  const { players } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  const browser = await chromium.launch()
  const ctxA = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

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

    await pageA.waitForTimeout(3000)
    await pageB.waitForTimeout(3000)

    // Exactly one should succeed (redirect to /session), one should show error
    const aUrl = pageA.url()
    const bUrl = pageB.url()
    const aSuccess = aUrl.includes('/session') && !aUrl.includes('/setup')
    const bSuccess = bUrl.includes('/session') && !bUrl.includes('/setup')

    // Exactly one should have succeeded
    expect(aSuccess !== bSuccess).toBe(true)

    // The failing one should show an error message
    const failingPage = aSuccess ? pageB : pageA
    await expect(failingPage.getByText('Sudah ada sesi aktif')).toBeVisible()

    // Cleanup: force-end via admin
    const { adminKey } = getTestData()
    await pageA.goto(`http://localhost:3000/admin?key=${adminKey}`)
    await pageA.waitForURL('**/admin')
    const forceEndBtn = pageA.getByRole('button', { name: 'Force-end sesi' })
    if (await forceEndBtn.isVisible()) {
      await forceEndBtn.click()
      await pageA.getByRole('button', { name: 'Yakin force-end' }).click()
    }
  } finally {
    await ctxA.close()
    await ctxB.close()
    await browser.close()
  }
})
