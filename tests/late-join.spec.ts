import { test, expect, type Page } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers } from './helpers'

const sql = neon(process.env.DATABASE_URL!)

async function endActiveSessions() {
  await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
}

/** Start a fresh Alice(dealer) + Bob session via the UI and land on /session. */
async function startAliceBobSession(page: Page, alice: { name: string }, bob: { name: string }) {
  await page.goto('/session/setup')
  await clickLabelFor(page, alice.name)
  await clickLabelFor(page, bob.name)
  await page.locator('label', { hasText: alice.name }).locator('input[type="radio"]').check()
  await page.getByRole('button', { name: 'Mulai' }).click()
  await page.waitForURL('**/session')
}

test.describe('Late join — add a member to a running session', () => {
  const { players } = getTestData()
  const alice = players[0]   // dealer (free entry in P1)
  const bob = players[1]     // pays buy-in
  const charlie = players[2] // late joiner

  test.beforeEach(async ({ page }) => {
    await endActiveSessions()
    await resetTestPlayers() // all → 500, cooldown cleared
    await setIdentity(page, alice)
    await startAliceBobSession(page, alice, bob)
  })

  test.afterEach(async () => {
    await endActiveSessions()
  })

  test('joins mid-game: appears as participant, balance −buy_in', async ({ page }) => {
    // Charlie is not seated yet
    await expect(page.getByText(charlie.name)).toHaveCount(0)

    await page.getByRole('button', { name: 'Tambah pemain' }).click()
    // Candidate row for Charlie (name match is a substring; his accessible name
    // also carries "Saldo: 500"). Other season members may also be candidates on
    // the shared DB — we only care that Charlie is selectable.
    const charlieCandidate = page.getByRole('button', { name: charlie.name })
    await expect(charlieCandidate).toBeVisible()
    await charlieCandidate.click()
    await page.getByRole('button', { name: 'Gabungkan' }).click()

    // Charlie now appears as a regular participant (has a "Rebuy: 0" card)
    const charlieCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: charlie.name }).last()
    await expect(charlieCard).toBeVisible({ timeout: 5000 })

    // Balance was deducted exactly one buy-in (500 → 400)
    await expect.poll(async () => {
      const rows = (await sql`SELECT balance FROM players WHERE id = ${charlie.id}`) as { balance: number }[]
      return rows[0]?.balance
    }, { timeout: 5000 }).toBe(400)
  })

  test('low-balance member is not a candidate', async ({ page }) => {
    // Drop Charlie below the buy-in (100) so he cannot join as a regular player.
    // (Other season members may still be candidates on the shared DB — the gate is
    // specifically that Charlie, now broke, is filtered out.)
    await sql`UPDATE players SET balance = 50 WHERE id = ${charlie.id}`
    await page.reload()

    await page.getByRole('button', { name: 'Tambah pemain' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('button', { name: charlie.name })).toHaveCount(0)
  })
})
