import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor, adminUrl, resetCooldown } from './helpers'

test.describe('Balance non-negative enforcement', () => {
  const td = getTestData()
  const alice = td.players[0]  // will be used as dealer (free buy-in)
  const bob = td.players[1]    // will be regular player

  test.beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE players SET balance = 500 WHERE id = ${alice.id}`
    await sql`UPDATE players SET balance = 500 WHERE id = ${bob.id}`
    await resetCooldown()
  })

  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
  })

  // M2: a player with balance < buy_in deals only (no ante, no playing) but still
  // earns the dealer salary. In Phase 1 that salary (buy_in = 100) is credited
  // directly since they can't play it: 50 → 150.
  test('low-balance dealer deals only but still earns the Phase 1 salary', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    // Low-balance Bob is still selectable (no disabling in the new model)
    const bobCheckbox = page.locator(`input[data-player-id="${bob.id}"]`)
    await expect(bobCheckbox).toBeEnabled()

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator(`input[name="dealer"][value="${bob.id}"]`).check()

    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Bob deals only (no ante) but gets the Phase 1 salary credited: 50 + 100 = 150
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(150)

    const [participant] = await sql`
      SELECT sp.is_dealer, sp.no_gaji_dealer
      FROM session_participants sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE s.status = 'active' AND sp.player_id = ${bob.id}
    ` as { is_dealer: boolean; no_gaji_dealer: boolean }[]
    expect(participant?.is_dealer).toBe(true)
    expect(participant?.no_gaji_dealer).toBe(true)

    // Alice (the actual player) paid buy-in: 500 → 400
    const [aliceRow] = await sql`SELECT balance FROM players WHERE id = ${alice.id}` as { balance: number }[]
    expect(Number(aliceRow.balance)).toBe(400)
  })

  test('rebuy is blocked when player balance < buy_in (no unlimited free rebuys)', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Drop Bob's balance below buy_in mid-session
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    const bobCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    // Wait for the 2s poll to reflect Bob's new saldo, then assert the
    // rebuy trigger is disabled and balance/rebuy_count are untouched.
    await expect(bobCard.getByText(/Saldo: 50/)).toBeVisible({ timeout: 5000 })

    const rebuyBtn = bobCard.getByRole('button', { name: /Saldo kurang|Rebuy/ })
    await expect(rebuyBtn).toBeDisabled()

    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(50)
    await expect(bobCard.getByText('Rebuy: 0')).toBeVisible()
  })

  test('admin edit balance to negative is rejected', async ({ page }) => {
    await page.goto(adminUrl(td.adminKey))

    const select = page.locator('select').first()
    await select.selectOption(bob.id)

    const balanceInput = page.getByPlaceholder('Balance baru (min 0)')
    await balanceInput.fill('-100')

    const reasonInput = page.getByPlaceholder('Alasan (wajib)')
    await reasonInput.fill('test negatif')

    await page.getByRole('button', { name: 'Update balance' }).click()

    await expect(page.getByText(/tidak valid/i)).toBeVisible({ timeout: 5000 })

    // Balance unchanged
    const sql = neon(process.env.DATABASE_URL!)
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(bobRow.balance).toBe(500)
  })

  test('dealer recommendation badge shows for lowest-balance player', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    // Alice 500, Bob 100 → Bob recommended as dealer
    await sql`UPDATE players SET balance = 100 WHERE id = ${bob.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)

    // Badge visible, bob's radio auto-selected
    await expect(page.getByText('REKOMENDASI')).toBeVisible()
    const bobRadio = page.locator('label', { hasText: bob.name }).locator('input[type="radio"]')
    await expect(bobRadio).toBeChecked()
  })

  test('dealer recommendation updates when player is deselected', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    const charlie = td.players[2]
    await sql`UPDATE players SET balance = 200 WHERE id = ${bob.id}`
    await sql`UPDATE players SET balance = 100 WHERE id = ${charlie.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await clickLabelFor(page, charlie.name)

    // Charlie (lowest) auto-selected
    const charlieRadio = page.locator('label', { hasText: charlie.name }).locator('input[type="radio"]')
    await expect(charlieRadio).toBeChecked()

    // Deselect charlie → bob becomes recommended
    await clickLabelFor(page, charlie.name)

    await expect(page.getByText('REKOMENDASI')).toBeVisible()
    const bobRadio = page.locator('label', { hasText: bob.name }).locator('input[type="radio"]')
    await expect(bobRadio).toBeChecked()
  })
})
