import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor, adminUrl } from './helpers'

test.describe('Balance non-negative enforcement', () => {
  const td = getTestData()
  const alice = td.players[0]  // will be used as dealer (free buy-in)
  const bob = td.players[1]    // will be regular player

  test.beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE players SET balance = 500 WHERE id = ${alice.id}`
    await sql`UPDATE players SET balance = 500 WHERE id = ${bob.id}`
  })

  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
  })

  test('player with balance 50 only pays 50 on buy-in — balance ends at 0, not negative', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)

    // Force alice as dealer
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()

    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Bob paid only 50 (what he had), balance = 0
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(bobRow.balance).toBe(0)
  })

  test('player with balance 0 pays nothing on buy-in — balance stays at 0', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`UPDATE players SET balance = 0 WHERE id = ${bob.id}`

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)

    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()

    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(bobRow.balance).toBe(0)
  })

  test('player with balance 50 only pays 50 on rebuy — balance ends at 0, not negative', async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!)

    await setIdentity(page, alice)
    await page.goto('/session/setup')

    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    const aliceRadio = page.locator('label', { hasText: alice.name }).locator('input[type="radio"]')
    await aliceRadio.check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // Set bob to 50 mid-session
    await sql`UPDATE players SET balance = 50 WHERE id = ${bob.id}`

    const bobCard = page.locator('div').filter({
      has: page.locator('p', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    await bobCard.getByRole('button', { name: 'Rebuy' }).click()
    await expect(page.getByText('Balance kepotong 100')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Rebuy' }).last().click()

    await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })

    // Bob paid only 50 (what he had), balance = 0
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(bobRow.balance).toBe(0)
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

    await expect(page.getByText(/tidak valid|Balance/i)).toBeVisible({ timeout: 5000 })

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
