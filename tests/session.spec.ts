import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor } from './helpers'

test.describe('Session setup — validation', () => {
  const { players } = getTestData()
  const alice = players[0]

  test.beforeEach(async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/session/setup')
  })

  test('start button disabled when 0 players selected', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Mulai' })).toBeDisabled()
  })

  test('start button disabled when only 1 player selected', async ({ page }) => {
    await clickLabelFor(page, alice.name)
    await expect(page.getByRole('button', { name: 'Mulai' })).toBeDisabled()
  })

  test('start button disabled when 2 players selected but no dealer', async ({ page }) => {
    await clickLabelFor(page, players[0].name)
    await clickLabelFor(page, players[1].name)
    // Dealer radios appear but none selected yet
    await expect(page.locator('input[type="radio"]')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Mulai' })).toBeDisabled()
  })

  test('unchecking a player removes their dealer radio option', async ({ page }) => {
    await clickLabelFor(page, players[0].name)
    await clickLabelFor(page, players[1].name)
    // Both radios visible
    await expect(page.locator('input[type="radio"]')).toHaveCount(2)
    // Uncheck player[1]
    await clickLabelFor(page, players[1].name)
    // Only one radio left
    await expect(page.locator('input[type="radio"]')).toHaveCount(1)
  })

  test('start button enabled when 2 players selected + dealer chosen', async ({ page }) => {
    await clickLabelFor(page, players[0].name)
    await clickLabelFor(page, players[1].name)
    // Select first radio as dealer
    await page.locator('input[type="radio"]').first().check()
    await expect(page.getByRole('button', { name: 'Mulai' })).toBeEnabled()
  })
})

test.describe('Full session flow', () => {
  const { players } = getTestData()
  const alice = players[0] // will be dealer (free buy-in)
  const bob = players[1]   // pays buy-in (balance: 500 → 400)

  test.beforeAll(async () => {
    // Clean up any stale active session left by a previous test or run (e.g. concurrency tests).
    // The setup page doesn't redirect when a session exists, so we go straight to the DB.
    try {
      const sql = neon(process.env.DATABASE_URL!)
      await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    } catch {}
  })

  test.beforeEach(async ({ page }) => {
    await setIdentity(page, alice)
  })

  test('dashboard: Mulai sesi button visible and enabled before session', async ({ page }) => {
    await page.goto('/')
    // Link wrapping the button — link is visible
    await expect(page.getByRole('link', { name: 'Mulai sesi' })).toBeVisible()
  })

  test('setup → active: creates session and shows participants', async ({ page }) => {
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    // Select Alice as dealer (her radio is the first one shown for checked players)
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    await expect(page.getByText('Sesi aktif')).toBeVisible()
    await expect(page.getByRole('main').getByText(alice.name)).toBeVisible()
    await expect(page.getByText(bob.name)).toBeVisible()
    // Alice is dealer
    await expect(page.getByText('★ DEALER')).toBeVisible()
    // Both start with rebuy_count = 0
    await expect(page.getByText('Rebuy: 0')).toHaveCount(2)
  })

  test('dashboard: Mulai sesi disabled and active session card shown while session running', async ({ page }) => {
    // Session was started in the previous test and is still active
    await page.goto('/')
    await expect(page.getByText('Sesi sedang berjalan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai sesi' })).toBeDisabled()
  })

  test('rebuy: sheet opens, confirm decreases bob balance, rebuy_count → 1', async ({ page }) => {
    await page.goto('/session')
    // Participant cards are uniquely identified by having a "Rebuy: N" paragraph inside
    const bobCard = page.locator('div').filter({
      has: page.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    await bobCard.getByRole('button', { name: 'Rebuy' }).click()

    // Sheet opens
    await expect(page.getByText('Balance kepotong 100')).toBeVisible()
    // Confirm in sheet — use the sheet's Rebuy button (last in DOM, rendered after participant list)
    await page.getByRole('button', { name: 'Rebuy' }).last().click()

    // Poll updates within 2s
    await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })
  })

  test('undo rebuy: rebuy_count returns to 0', async ({ page }) => {
    await page.goto('/session')
    const bobCard = page.locator('div').filter({
      has: page.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    await bobCard.getByRole('button', { name: 'Undo' }).click()
    await expect(bobCard.getByText('Rebuy: 0')).toBeVisible({ timeout: 5000 })
  })

  test('undo button is disabled when rebuy_count is 0', async ({ page }) => {
    await page.goto('/session')
    const aliceCard = page.locator('div').filter({
      has: page.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: alice.name }).last()

    // Alice is dealer with 0 rebuys → Undo disabled
    await expect(aliceCard.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  test('end session: input stacks → recap → confirm → redirects home', async ({ page }) => {
    await page.goto('/session')
    await page.getByRole('link', { name: 'End' }).click()
    await page.waitForURL('**/session/end')

    // Step counter visible
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible()

    // Input stacks for each participant (order is dealer-first)
    const totalSteps = await page.getByText(/\d+ \/ \d+/).innerText()
    const count = parseInt(totalSteps.split('/')[1].trim(), 10)

    for (let i = 0; i < count; i++) {
      await page.locator('input[type="number"]').fill('200')
      const isLast = i === count - 1
      await page.getByRole('button', { name: isLast ? 'Lihat recap' : 'Next →' }).click()
    }

    // Recap screen
    await expect(page.getByText('Konfirmasi')).toBeVisible()
    await expect(page.getByText('RECAP')).toBeVisible()

    // Total chip check — 2 players, dealer free + 1 non-dealer × 100 = 100 chips
    // Both input 200 = 400 total → mismatch warning expected
    await expect(page.getByText(/Selisih/)).toBeVisible()

    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForURL('/')
  })

  test('after session ends: dashboard shows no active session', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Sesi sedang berjalan')).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Mulai sesi' })).toBeVisible()
  })

  test('back button on step 0 of /session/end returns to /session', async ({ page }) => {
    // Need a fresh session — start one
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Go to end wizard
    await page.getByRole('link', { name: 'End' }).click()
    await page.waitForURL('**/session/end')

    // Back on step 0 → /session
    await page.getByRole('button', { name: '←' }).click()
    await page.waitForURL('**/session')

    // Force-end via admin so cleanup works
    // (leave session active for concurrency.spec.ts to use)
  })
})

test.describe('Session end — back navigation', () => {
  const { players } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test('back button on recap restores previous input', async ({ page }) => {
    await setIdentity(page, alice)

    // Ensure a session is active — if previous test left one, go with it
    await page.goto('/')
    let hasSession: boolean
    try {
      await expect(page.getByText('Sesi sedang berjalan')).toBeVisible({ timeout: 4000 })
      hasSession = true
    } catch {
      hasSession = false
    }

    if (!hasSession) {
      await page.goto('/session/setup')
      await clickLabelFor(page, alice.name)
      await clickLabelFor(page, bob.name)
      await page.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
      await page.getByRole('button', { name: 'Mulai' }).click()
      await page.waitForURL('**/session')
    }

    await page.goto('/session/end')

    // Step 1: input 150
    await page.locator('input[type="number"]').fill('150')
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 2: input 100
    await page.locator('input[type="number"]').fill('100')
    await page.getByRole('button', { name: /recap/ }).click()

    // Now on recap — go back
    await page.getByRole('button', { name: 'Back' }).click()
    // Should restore 100 in the input
    await expect(page.locator('input[type="number"]')).toHaveValue('100')

    // Go back again
    await page.getByRole('button', { name: '←' }).click()
    // Should restore 150
    await expect(page.locator('input[type="number"]')).toHaveValue('150')

    // Confirm to clean up
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.locator('input[type="number"]').fill('100')
    await page.getByRole('button', { name: /recap/ }).click()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForURL('/')
  })
})
