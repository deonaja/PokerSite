import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'
import { getTestData, setIdentity } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)

// C1 (migration 007): the dashboard / poll scope to season_players — only the
// active season's members are shown. A registered player who is NOT a member
// must be invisible until they join the roster.
test.describe('Membership (season_players) scoping', () => {
  const { seasonId, runId, players } = getTestData()
  const alice = players[0] // seeded as a member by global-setup
  const outsiderName = `[T${runId}] Outsider`
  let outsiderId: string

  test.beforeAll(async () => {
    const sql = db()
    const pinHash = await hashPin('1234')
    const rows = (await sql`
      INSERT INTO players (name, balance, pin_hash) VALUES (${outsiderName}, 500, ${pinHash})
      RETURNING id
    `) as { id: string }[]
    outsiderId = rows[0].id
    // Intentionally NOT inserted into season_players → not a member yet.
    await sql`DELETE FROM season_players WHERE player_id = ${outsiderId}`
  })

  test.afterAll(async () => {
    const sql = db()
    await sql`DELETE FROM season_players WHERE player_id = ${outsiderId}`
    await sql`DELETE FROM players WHERE id = ${outsiderId}`
  })

  test('dashboard hides a non-member, shows them after they join the season', async ({ page }) => {
    await setIdentity(page, alice)

    // A member (alice) is visible; the non-member is not on the dashboard.
    await page.goto('/')
    await expect(page.getByText(alice.name).first()).toBeVisible()
    await expect(page.getByText(outsiderName)).toHaveCount(0)

    // Joining the active season's roster makes them appear.
    await db()`
      INSERT INTO season_players (season_id, player_id) VALUES (${seasonId}, ${outsiderId})
      ON CONFLICT DO NOTHING
    `
    await page.goto('/')
    await expect(page.getByText(outsiderName).first()).toBeVisible()
  })
})
