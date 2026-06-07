import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers, fillNewSeasonPlayers } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)

// ─────────────────────────────────────────────────────────────────────────────
// M2: Change own PIN (/settings/pin)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M2: change own PIN', () => {
  const { players } = getTestData()
  const alice = players[0]

  test.afterAll(async () => {
    // Restore Alice's PIN to the default so other specs/runs are unaffected
    const hash = await hashPin('1234')
    await db()`UPDATE players SET pin_hash = ${hash} WHERE id = ${alice.id}`
  })

  test('wrong old PIN shows an error', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/settings/pin')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('0000') // wrong current PIN
    await inputs.nth(1).fill('5555')
    await inputs.nth(2).fill('5555')
    await page.getByRole('button', { name: 'Simpan PIN' }).click()
    await expect(page.getByText('PIN lama salah')).toBeVisible()
  })

  test('correct old PIN updates to the new PIN', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/settings/pin')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('1234') // correct current PIN
    await inputs.nth(1).fill('9999')
    await inputs.nth(2).fill('9999')
    await page.getByRole('button', { name: 'Simpan PIN' }).click()
    await expect(page.getByText('PIN berhasil diubah')).toBeVisible()

    // New PIN actually verifies against the stored hash
    await page.goto('/identity')
    await page.getByRole('button', { name: alice.name }).click()
    await page.getByPlaceholder('PIN (4-6 digit)').fill('9999')
    await page.getByRole('button', { name: 'Masuk' }).click()
    await page.waitForURL('/')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M2: Phase transition bootstrap → steady
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M2: phase transition bootstrap → steady', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test.beforeAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
    // Lower max_pool below total chips so the next session start flips to steady
    await sql`UPDATE seasons SET max_pool = 100, current_phase = 'bootstrap' WHERE id = ${seasonId}`
  })

  test.afterAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE seasons SET max_pool = 100000000, current_phase = 'bootstrap' WHERE id = ${seasonId}`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  })

  test('starting a session flips phase to steady and dealer pays buy-in', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator('label', { hasText: alice.name }).locator('input[name="dealer"]').check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    const sql = db()
    const [season] = await sql`SELECT current_phase FROM seasons WHERE id = ${seasonId}` as { current_phase: string }[]
    expect(season.current_phase).toBe('steady')

    // In steady phase the dealer (Alice) also pays buy-in: 500 - 100 = 400
    const [aliceRow] = await sql`SELECT balance FROM players WHERE id = ${alice.id}` as { balance: number }[]
    expect(Number(aliceRow.balance)).toBe(400)
  })

  test('dashboard shows the STEADY badge', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/')
    await expect(page.getByText('STEADY')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M2: Dealer cooldown (Phase 1 only)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M2: dealer cooldown in Phase 1', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  test.beforeAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE seasons SET current_phase = 'bootstrap', max_pool = 100000000 WHERE id = ${seasonId}`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  })

  test.afterAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  })

  test('a player who just dealt shows a cooldown badge next session (not blocked)', async ({ page }) => {
    // Session 1: Alice deals (Phase 1 free entry → sets the cooldown anchor)
    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator(`input[name="dealer"][value="${alice.id}"]`).check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    // End session 1
    await db()`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`

    // Session 2 setup: Alice shows a cooldown badge but is STILL selectable as dealer
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, charlie.name)

    await expect(page.getByText(/cooldown/)).toBeVisible()
    const aliceDealerRadio = page.locator(`input[name="dealer"][value="${alice.id}"]`)
    await expect(aliceDealerRadio).toBeEnabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M2: Deals-only dealer (low balance + Phase 2 → deals, no ante, no salary)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M2: deals-only dealer in Phase 2', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test.beforeAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
    await sql`UPDATE players SET balance = 0 WHERE id = ${bob.id}`
    await sql`UPDATE seasons SET current_phase = 'steady', max_pool = 100 WHERE id = ${seasonId}`
  })

  test.afterAll(async () => {
    const sql = db()
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE seasons SET current_phase = 'bootstrap', max_pool = 100000000 WHERE id = ${seasonId}`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  })

  test('low-balance dealer in Phase 2 deals only (no ante, balance untouched)', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    // Bob has 0 balance and it's Phase 2 (no free entry) → he can only deal
    await page.locator(`input[name="dealer"][value="${bob.id}"]`).check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')

    const sql = db()
    const [bobRow] = await sql`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(bobRow.balance)).toBe(0)

    const [participant] = await sql`
      SELECT sp.no_gaji_dealer
      FROM session_participants sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE s.status = 'active' AND sp.player_id = ${bob.id}
    ` as { no_gaji_dealer: boolean }[]
    expect(participant?.no_gaji_dealer).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M2: Season creation flow (/season/new)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('M2: season creation flow', () => {
  const { seasonId } = getTestData()

  test.beforeAll(async () => {
    const sql = db()
    // End the active season so /season/new is reachable (otherwise it redirects to /)
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await sql`UPDATE seasons SET status = 'ended', ended_at = now() WHERE id = ${seasonId}`
  })

  test.afterAll(async () => {
    const sql = db()
    // Remove any season created during this spec, then restore the global test season
    await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    const strays = await sql`SELECT id FROM seasons WHERE status = 'active' AND id != ${seasonId}` as { id: string }[]
    for (const s of strays) {
      await sql`DELETE FROM edit_log WHERE action = 'season_start' AND metadata->>'season_id' = ${s.id}`
      await sql`DELETE FROM seasons WHERE id = ${s.id}`
    }
    await sql`UPDATE seasons SET status = 'active', ended_at = NULL WHERE id = ${seasonId}`
    await sql`UPDATE players SET balance = 500, last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  })

  test('walks through the multi-step form and creates an active season', async ({ page }) => {
    await page.goto('/season/new')

    // Step 1 is a checklist (existing players unchecked) + add-new section. Add
    // 2 fresh [T]-prefixed players so we never touch any real registered player.
    await expect(page.getByText('Siapa yang main?')).toBeVisible()
    const runId = getTestData().runId
    await fillNewSeasonPlayers(page, [`[T${runId}] SC0`, `[T${runId}] SC1`])
    await page.getByRole('button', { name: /Lanjut/ }).click()

    // Step 2: buy-in & nyawa (defaults: buy_in 100 × nyawa 5 → starting_balance 500)
    await expect(page.getByText('Buy-in & nyawa')).toBeVisible()
    await page.getByRole('button', { name: /Lanjut/ }).click()

    // Step 3: durasi & tempo (Standard + Langsung serius by default)
    await expect(page.getByText('Durasi & tempo')).toBeVisible()
    await page.getByRole('button', { name: /Lanjut/ }).click()

    // Step 4: confirm
    await expect(page.getByRole('button', { name: 'Mulai Season' })).toBeVisible()
    await page.getByRole('button', { name: 'Mulai Season' }).click()
    await page.waitForURL('**/identity')

    const sql = db()
    const [season] = await sql`
      SELECT id, starting_balance, buy_in, current_phase
      FROM seasons WHERE status = 'active' ORDER BY started_at DESC LIMIT 1
    ` as { id: string; starting_balance: number; buy_in: number; current_phase: string }[]
    expect(Number(season.starting_balance)).toBe(500)
    expect(Number(season.buy_in)).toBe(100)
    expect(season.current_phase).toBe('bootstrap')
  })
})
