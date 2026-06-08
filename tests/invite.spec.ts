import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'
import { getTestData, setIdentity } from './helpers'

// Fase E: self-registration (invite code), mid-season join, guest spectator.
const db = () => neon(process.env.DATABASE_URL!)
const { seasonId, runId, players } = getTestData()
const alice = players[0]
const KNOWN_CODE = 'E5TESTXX'
const NAME_PREFIX = `[T${runId}] E5-`

async function suppressWelcome(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('panduan_seen', '1'))
}

test.describe('Fase E — register / join / guest', () => {
  let savedCode: string | null = null

  test.beforeAll(async () => {
    const sql = db()
    const rows = (await sql`SELECT invite_code FROM seasons WHERE id = ${seasonId}`) as { invite_code: string | null }[]
    savedCode = rows[0]?.invite_code ?? null
    // Pin a known code + bootstrap phase so registration is deterministic.
    await sql`UPDATE seasons SET invite_code = ${KNOWN_CODE}, invite_code_uses = 0, current_phase = 'bootstrap' WHERE id = ${seasonId}`
  })

  test.afterAll(async () => {
    const sql = db()
    // Remove any accounts these tests created (members → season_players cascades;
    // null their edit_log first since player_id is ON DELETE SET NULL).
    const created = (await sql`SELECT id FROM players WHERE name LIKE ${NAME_PREFIX + '%'}`) as { id: string }[]
    if (created.length) {
      const ids = created.map((r) => r.id)
      await sql`DELETE FROM edit_log WHERE player_id = ANY(${ids}::uuid[])`
      await sql`DELETE FROM season_players WHERE player_id = ANY(${ids}::uuid[])`
      await sql`DELETE FROM players WHERE id = ANY(${ids}::uuid[])`
    }
    await sql`UPDATE seasons SET invite_code = ${savedCode}, invite_code_uses = 0 WHERE id = ${seasonId}`
  })

  test('register with the invite code creates a member with phase-aware balance', async ({ page }) => {
    await suppressWelcome(page)
    const name = `${NAME_PREFIX}Newbie`

    await page.goto('/identity')
    await page.getByRole('button', { name: '+ Daftar pemain baru' }).click()
    await page.getByPlaceholder('Nama kamu').fill(name)
    await page.getByPlaceholder(/Buat PIN/).fill('4321')
    await page.getByPlaceholder('Kode undangan').fill(KNOWN_CODE.toLowerCase()) // case-insensitive
    await page.getByRole('button', { name: 'Daftar' }).click()

    await expect(page).toHaveURL('/', { timeout: 15_000 })

    const row = (await db()`
      SELECT p.balance, (mp.player_id IS NOT NULL) AS is_member
      FROM players p
      LEFT JOIN season_players mp ON mp.player_id = p.id AND mp.season_id = ${seasonId}
      WHERE p.name = ${name}
    `) as { balance: number; is_member: boolean }[]
    expect(row[0]?.is_member).toBe(true)
    expect(row[0]?.balance).toBe(200) // bootstrap → starting_balance (test season = 200)
  })

  test('wrong invite code shows an error and creates no account', async ({ page }) => {
    await suppressWelcome(page)
    const name = `${NAME_PREFIX}BadCode`

    await page.goto('/identity')
    await page.getByRole('button', { name: '+ Daftar pemain baru' }).click()
    await page.getByPlaceholder('Nama kamu').fill(name)
    await page.getByPlaceholder(/Buat PIN/).fill('4321')
    await page.getByPlaceholder('Kode undangan').fill('NOPENOPE')
    await page.getByRole('button', { name: 'Daftar' }).click()

    await expect(page.getByText('Kode undangan salah')).toBeVisible()
    const rows = (await db()`SELECT id FROM players WHERE name = ${name}`) as { id: string }[]
    expect(rows.length).toBe(0)
  })

  test('logged-in non-member can join mid-season from the dashboard', async ({ page }) => {
    const sql = db()
    const name = `${NAME_PREFIX}Outsider`
    const pinHash = await hashPin('1234')
    const rows = (await sql`
      INSERT INTO players (name, balance, pin_hash) VALUES (${name}, 0, ${pinHash}) RETURNING id
    `) as { id: string }[]
    const outsider = { id: rows[0].id, name }
    await sql`DELETE FROM season_players WHERE player_id = ${outsider.id}` // ensure non-member

    await setIdentity(page, outsider)
    await page.goto('/')
    await page.getByRole('button', { name: 'Gabung musim' }).click()

    await expect
      .poll(async () => {
        const r = (await sql`SELECT 1 FROM season_players WHERE season_id = ${seasonId} AND player_id = ${outsider.id}`) as unknown[]
        return r.length
      })
      .toBe(1)
    const bal = (await sql`SELECT balance FROM players WHERE id = ${outsider.id}`) as { balance: number }[]
    expect(bal[0].balance).toBe(200) // bootstrap grant
  })

  test('guest /lihat shows standings read-only without redirecting to /identity', async ({ page }) => {
    await page.goto('/lihat')
    await expect(page).toHaveURL('/lihat')
    await expect(page.getByText(alice.name).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Daftar / Masuk' })).toBeVisible()
  })
})
