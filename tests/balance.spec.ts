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

  // M2: a low-balance dealer in Phase 1 (not in cooldown) gets the 2× buy_in
  // salary, SPLIT: 1× as chips on the table (played with) + 1× credited to their
  // bankroll (spare life). They do NOT pay buy-in (broke) and are NOT deals-only.
  test('low-balance dealer in Phase 1 gets salary: table chips + bankroll half', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    const bobCheckbox = page.locator(`input[data-player-id="${bob.id}"]`)
    await expect(bobCheckbox).toBeEnabled()

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator(`input[name="dealer"][value="${bob.id}"]`).check()

    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Bob plays as a normal dealer (not deals-only) with the printed salary chips.
    // No buy-in deduction (he is broke), but the bankroll half of the 2× salary
    // (1× buy_in = 100) is credited immediately → 50 + 100 = 150.
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(150)

    const [participant] = await sql`
      SELECT sp.is_dealer, sp.no_gaji_dealer
      FROM session_participants sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE s.status = 'active' AND sp.player_id = ${bob.id}
    ` as { is_dealer: boolean; no_gaji_dealer: boolean }[]
    expect(participant?.is_dealer).toBe(true)
    expect(participant?.no_gaji_dealer).toBe(false)

    // The salary chips were logged so the end-session chip total counts them.
    const [salaryLog] = await sql`
      SELECT 1 AS ok FROM edit_log
      WHERE player_id = ${bob.id} AND action = 'dealer_salary_chips'
        AND session_id = (SELECT id FROM sessions WHERE status = 'active' LIMIT 1)
    ` as { ok: number }[]
    expect(salaryLog?.ok).toBe(1)

    // Alice (the non-dealer) paid buy-in: 500 → 400
    const [aliceRow] = await sql`SELECT balance FROM players WHERE id = ${alice.id}` as { balance: number }[]
    expect(Number(aliceRow.balance)).toBe(400)
  })

  test('rebuy below buy_in takes the remaining balance (partial), floors at 0', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Drop Bob's balance below buy_in (100) mid-session — he can still rebuy,
    // taking only what's left (50), never going negative.
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    const bobCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    // Wait for the 2s poll to reflect Bob's new saldo. Rebuy stays enabled.
    await expect(bobCard.getByText(/Saldo: 50/)).toBeVisible({ timeout: 5000 })
    const rebuyBtn = bobCard.getByRole('button', { name: 'Rebuy' })
    await expect(rebuyBtn).toBeEnabled()

    // Sheet shows the partial amount, not the full buy-in.
    await rebuyBtn.click()
    await expect(page.getByText(/Balance kepotong 50/)).toBeVisible()
    await page.getByRole('button', { name: 'Rebuy' }).last().click()

    // Balance floors at 0, rebuy counted once.
    await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(0)

    // Now broke (0) → rebuy disabled with "Saldo habis".
    await expect(bobCard.getByText(/Saldo: 0/)).toBeVisible({ timeout: 5000 })
    await expect(bobCard.getByRole('button', { name: 'Saldo habis' })).toBeDisabled()
  })

  test('undo of a partial rebuy restores the partial amount, not a full buy-in', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)

    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Below buy_in (100): a partial rebuy takes the remaining 50.
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`
    const bobCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    await expect(bobCard.getByText(/Saldo: 50/)).toBeVisible({ timeout: 5000 })

    await bobCard.getByRole('button', { name: 'Rebuy' }).click()
    await page.getByRole('button', { name: 'Rebuy' }).last().click()
    await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })

    // Undo must give back exactly 50 (the partial), not a full 100 buy-in.
    await bobCard.getByRole('button', { name: 'Undo' }).click()
    await expect(bobCard.getByText('Rebuy: 0')).toBeVisible({ timeout: 5000 })
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(50)
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
