import { test, expect, type Page } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers, adminUrl } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)

interface CreatedSeason {
  id: string
  number: number
  starting_balance: number
  buy_in: number
}

async function forceEndAllSessions() {
  await db()`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
}

async function createActiveSeason({
  startingBalance = 200,
  buyIn = 100,
  maxSessions = 2,
  phase = 'bootstrap',
  rakeRate = 10,
}: {
  startingBalance?: number
  buyIn?: number
  maxSessions?: number
  phase?: 'bootstrap' | 'steady'
  rakeRate?: number
} = {}): Promise<CreatedSeason> {
  const [season] = await db()`
    INSERT INTO seasons
      (number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase)
    VALUES
      ((SELECT COALESCE(MAX(number), 0) + 1 FROM seasons), 'active', 'standard', ${startingBalance}, ${buyIn}, 10, 5, 100000000, ${maxSessions}, ${rakeRate}, ${phase})
    RETURNING id, number, starting_balance, buy_in
  ` as { id: string; number: number; starting_balance: number; buy_in: number }[]
  return season
}

async function cleanupSeason(seasonId: string) {
  const sql = db()
  await sql`
    UPDATE players
    SET last_dealer_session_id = NULL
    WHERE last_dealer_session_id IN (SELECT id FROM sessions WHERE season_id = ${seasonId})
  `
  await sql`DELETE FROM edit_log WHERE session_id IN (SELECT id FROM sessions WHERE season_id = ${seasonId})`
  await sql`DELETE FROM edit_log WHERE metadata->>'season_id' = ${seasonId}`
  await sql`DELETE FROM session_participants WHERE session_id IN (SELECT id FROM sessions WHERE season_id = ${seasonId})`
  await sql`DELETE FROM sessions WHERE season_id = ${seasonId}`
  await sql`DELETE FROM season_results WHERE season_id = ${seasonId}`
  await sql`DELETE FROM seasons WHERE id = ${seasonId}`
}

async function restoreBaseline(baseSeasonId: string) {
  await forceEndAllSessions()
  await db()`
    UPDATE seasons
    SET status = 'ended', ended_at = COALESCE(ended_at, now())
    WHERE status = 'active' AND id != ${baseSeasonId}
  `
  await db()`
    UPDATE seasons
    SET status = 'active',
        ended_at = NULL,
        preset_name = 'standard',
        starting_balance = 200,
        buy_in = 100,
        bb = 10,
        sb = 5,
        max_pool = 100000000,
        max_sessions = 100000,
        rake_rate = 10,
        current_phase = 'bootstrap'
    WHERE id = ${baseSeasonId}
  `
  await resetTestPlayers(500)
}

async function startSessionFromSetup({
  page,
  actor,
  selectedNames,
  dealerId,
}: {
  page: Page
  actor: { id: string; name: string }
  selectedNames: string[]
  dealerId: string
}) {
  await setIdentity(page, actor)
  await page.goto('/session/setup')
  for (const name of selectedNames) {
    await clickLabelFor(page, name)
  }
  await page.locator(`input[name="dealer"][value="${dealerId}"]`).check()
  await page.getByRole('button', { name: 'Mulai' }).click()
  await page.waitForURL('**/session')
}

async function finishSessionViaWizard(page: Page, stacks: number[]) {
  await page.goto('/session/end')
  for (let i = 0; i < stacks.length; i++) {
    await page.locator('input[type="number"]').fill(String(stacks[i]))
    const isLast = i === stacks.length - 1
    await page.getByRole('button', { name: isLast ? /Lihat recap/ : /^Next/ }).click()
  }
  await page.getByRole('button', { name: 'Confirm' }).click()
}

test.describe('M3: season end, leaderboard, history', () => {
  const { players, seasonId: baseSeasonId, adminKey } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  test('max_sessions reached -> redirects to /season/end; confirm snapshots, resets, and prefill follows rank order', async ({ page }) => {
    const createdSeasonIds: string[] = []
    try {
      await restoreBaseline(baseSeasonId)
      await db()`UPDATE seasons SET status = 'ended', ended_at = now() WHERE status = 'active'`

      const season = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 1, phase: 'bootstrap' })
      createdSeasonIds.push(season.id)
      await resetTestPlayers(500)

      await startSessionFromSetup({
        page,
        actor: alice,
        selectedNames: [alice.name, bob.name],
        dealerId: alice.id,
      })

      await finishSessionViaWizard(page, [150, 50])
      await page.waitForURL(new RegExp(`/season/end\\?id=${season.id}$`))
      await expect(page.getByText(`MUSIM #${season.number} SELESAI`)).toBeVisible()

      const [beforeConfirm] = await db()`
        SELECT status FROM seasons WHERE id = ${season.id}
      ` as { status: string }[]
      expect(beforeConfirm.status).toBe('active')

      const [resultsBefore] = await db()`
        SELECT COUNT(*)::int AS cnt FROM season_results WHERE season_id = ${season.id}
      ` as { cnt: number }[]
      expect(Number(resultsBefore.cnt)).toBe(0)

      const balancesBeforeEnd = await db()`
        SELECT id, balance
        FROM players
        WHERE id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { id: string; balance: number }[]
      const beforeMap = new Map(balancesBeforeEnd.map((r) => [r.id, Number(r.balance)]))

      await page.getByRole('button', { name: 'Akhiri Musim' }).click()
      await expect(page.getByText('Yakin? Balance semua pemain akan di-reset.')).toBeVisible()
      await page.getByRole('button', { name: 'Ya, Akhiri Musim' }).click()
      await page.waitForURL('/season/new')

      const [seasonAfter] = await db()`
        SELECT status, ended_at
        FROM seasons
        WHERE id = ${season.id}
      ` as { status: string; ended_at: string | null }[]
      expect(seasonAfter.status).toBe('ended')
      expect(seasonAfter.ended_at).toBeTruthy()

      const resultRows = await db()`
        SELECT player_id, final_balance, rank, sessions_played, times_dealer, total_won, total_lost
        FROM season_results
        WHERE season_id = ${season.id}
          AND player_id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as {
        player_id: string
        final_balance: number
        rank: number
        sessions_played: number
        times_dealer: number
        total_won: number
        total_lost: number
      }[]
      expect(resultRows).toHaveLength(3)

      const byPlayer = new Map(resultRows.map((r) => [r.player_id, r]))
      const aliceRes = byPlayer.get(alice.id)!
      const bobRes = byPlayer.get(bob.id)!
      const charlieRes = byPlayer.get(charlie.id)!

      expect(Number(aliceRes.final_balance)).toBe(beforeMap.get(alice.id))
      expect(Number(bobRes.final_balance)).toBe(beforeMap.get(bob.id))
      expect(Number(charlieRes.final_balance)).toBe(beforeMap.get(charlie.id))

      expect(Number(aliceRes.sessions_played)).toBe(1)
      expect(Number(aliceRes.times_dealer)).toBe(1)
      expect(Number(aliceRes.total_won)).toBe(0)
      expect(Number(aliceRes.total_lost)).toBe(50)

      expect(Number(bobRes.sessions_played)).toBe(1)
      expect(Number(bobRes.times_dealer)).toBe(0)
      expect(Number(bobRes.total_won)).toBe(0)
      expect(Number(bobRes.total_lost)).toBe(50)

      expect(Number(charlieRes.sessions_played)).toBe(0)
      expect(Number(charlieRes.times_dealer)).toBe(0)
      expect(Number(charlieRes.total_won)).toBe(0)
      expect(Number(charlieRes.total_lost)).toBe(0)

      // Relative rank order among our controlled players must follow final_balance.
      expect(aliceRes.rank).toBeLessThan(charlieRes.rank)
      expect(charlieRes.rank).toBeLessThan(bobRes.rank)

      const balancesAfterReset = await db()`
        SELECT id, balance
        FROM players
        WHERE id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { id: string; balance: number }[]
      for (const row of balancesAfterReset) {
        expect(Number(row.balance)).toBe(season.starting_balance)
      }

      const [seasonEndLogs] = await db()`
        SELECT COUNT(*)::int AS cnt
        FROM edit_log
        WHERE action = 'season_end'
          AND metadata->>'season_id' = ${season.id}
          AND player_id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { cnt: number }[]
      expect(Number(seasonEndLogs.cnt)).toBe(3)

      // /season/new prefill must follow previous season rank order.
      const expectedNames = await db()`
        SELECT p.name
        FROM season_results sr
        JOIN players p ON p.id = sr.player_id
        WHERE sr.season_id = ${season.id}
        ORDER BY sr.rank ASC
      ` as { name: string }[]

      await expect(page.getByRole('heading', { name: 'Siapa yang main?' })).toBeVisible()
      const nameInputs = page.getByPlaceholder(/Nama kamu|Pemain/)
      const checkCount = Math.min(5, await nameInputs.count(), expectedNames.length)
      for (let i = 0; i < checkCount; i++) {
        await expect(nameInputs.nth(i)).toHaveValue(expectedNames[i].name)
      }

      // Ended season page should no longer be accessible once a new active season exists.
      const nextSeason = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 20, phase: 'bootstrap' })
      createdSeasonIds.push(nextSeason.id)
      await setIdentity(page, alice)
      await page.goto(`/season/end?id=${season.id}`)
      await page.waitForURL('/')
    } finally {
      for (const id of createdSeasonIds) {
        await cleanupSeason(id)
      }
      await restoreBaseline(baseSeasonId)
    }
  })

  test('steady phase + rebuy undo stats are correct and phase stays steady after season end', async ({ page }) => {
    const createdSeasonIds: string[] = []
    try {
      await restoreBaseline(baseSeasonId)
      await db()`UPDATE seasons SET status = 'ended', ended_at = now() WHERE status = 'active'`

      const season = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 1, phase: 'steady' })
      createdSeasonIds.push(season.id)
      await resetTestPlayers(500)

      await startSessionFromSetup({
        page,
        actor: alice,
        selectedNames: [alice.name, bob.name],
        dealerId: alice.id,
      })

      await page.goto('/session')
      const bobCard = page.locator('div').filter({
        has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
      }).filter({ hasText: bob.name }).last()

      await bobCard.getByRole('button', { name: 'Rebuy' }).click()
      await page.getByRole('button', { name: 'Rebuy' }).last().click()
      await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })

      await bobCard.getByRole('button', { name: 'Undo' }).click()
      await expect(bobCard.getByText('Rebuy: 0')).toBeVisible({ timeout: 5000 })

      await finishSessionViaWizard(page, [180, 20])
      await page.waitForURL(new RegExp(`/season/end\\?id=${season.id}$`))

      await page.getByRole('button', { name: 'Akhiri Musim' }).click()
      await page.getByRole('button', { name: 'Ya, Akhiri Musim' }).click()
      await page.waitForURL('/season/new')

      const [seasonAfter] = await db()`
        SELECT status, current_phase
        FROM seasons
        WHERE id = ${season.id}
      ` as { status: string; current_phase: string }[]
      expect(seasonAfter.status).toBe('ended')
      expect(seasonAfter.current_phase).toBe('steady')

      const resultRows = await db()`
        SELECT player_id, sessions_played, times_dealer, total_won, total_lost
        FROM season_results
        WHERE season_id = ${season.id}
          AND player_id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as {
        player_id: string
        sessions_played: number
        times_dealer: number
        total_won: number
        total_lost: number
      }[]
      expect(resultRows).toHaveLength(3)

      const byPlayer = new Map(resultRows.map((r) => [r.player_id, r]))
      const aliceRes = byPlayer.get(alice.id)!
      const bobRes = byPlayer.get(bob.id)!
      const charlieRes = byPlayer.get(charlie.id)!

      expect(Number(aliceRes.sessions_played)).toBe(1)
      expect(Number(aliceRes.times_dealer)).toBe(1)
      expect(Number(aliceRes.total_won)).toBe(80)
      expect(Number(aliceRes.total_lost)).toBe(0)

      expect(Number(bobRes.sessions_played)).toBe(1)
      expect(Number(bobRes.times_dealer)).toBe(0)
      expect(Number(bobRes.total_won)).toBe(0)
      expect(Number(bobRes.total_lost)).toBe(80)

      expect(Number(charlieRes.sessions_played)).toBe(0)
      expect(Number(charlieRes.times_dealer)).toBe(0)
      expect(Number(charlieRes.total_won)).toBe(0)
      expect(Number(charlieRes.total_lost)).toBe(0)
    } finally {
      for (const id of createdSeasonIds) {
        await cleanupSeason(id)
      }
      await restoreBaseline(baseSeasonId)
    }
  })

  test('history page and player detail show season-result data and dashboard links navigate correctly', async ({ page }) => {
    const createdSeasonIds: string[] = []
    try {
      await restoreBaseline(baseSeasonId)
      await db()`UPDATE seasons SET status = 'ended', ended_at = now() WHERE status = 'active'`

      const season = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 1, phase: 'bootstrap' })
      createdSeasonIds.push(season.id)
      await resetTestPlayers(500)

      await startSessionFromSetup({
        page,
        actor: alice,
        selectedNames: [alice.name, bob.name],
        dealerId: alice.id,
      })
      await finishSessionViaWizard(page, [160, 40])
      await page.waitForURL(new RegExp(`/season/end\\?id=${season.id}$`))
      await page.getByRole('button', { name: 'Akhiri Musim' }).click()
      await page.getByRole('button', { name: 'Ya, Akhiri Musim' }).click()
      await page.waitForURL('/season/new')

      const [aliceSeasonRow] = await db()`
        SELECT final_balance, rank
        FROM season_results
        WHERE season_id = ${season.id} AND player_id = ${alice.id}
      ` as { final_balance: number; rank: number }[]

      // Create a new active season so (main) routes are reachable.
      const nextSeason = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 20, phase: 'bootstrap' })
      createdSeasonIds.push(nextSeason.id)

      await setIdentity(page, alice)
      await page.goto('/')
      await page.getByRole('link', { name: /Riwayat musim/ }).click()
      await page.waitForURL('/season/history')
      await expect(page.getByText('Riwayat Musim')).toBeVisible()
      await expect(page.getByText(`Musim #${season.number}`)).toBeVisible()

      await page.getByRole('button', { name: new RegExp(`Musim #${season.number}`) }).click()
      const expandedSeason = page.locator('div').filter({ hasText: `Musim #${season.number}` }).first()
      await expect(expandedSeason.getByText(alice.name, { exact: true }).first()).toBeVisible()

      await page.goto('/')
      await page.getByRole('link', { name: alice.name }).first().click()
      await page.waitForURL(new RegExp(`/player/${alice.id}$`))
      await expect(page.getByText('STATISTIK KESELURUHAN')).toBeVisible()
      await expect(page.getByText('PER MUSIM')).toBeVisible()
      await expect(page.getByText(`Musim #${season.number}`)).toBeVisible()
      const seasonCard = page.locator('div').filter({ hasText: `Musim #${season.number}` }).first()
      await expect(seasonCard.getByText(String(aliceSeasonRow.final_balance), { exact: true })).toBeVisible()
    } finally {
      for (const id of createdSeasonIds) {
        await cleanupSeason(id)
      }
      await restoreBaseline(baseSeasonId)
    }
  })

  test('admin force end season snapshots final balances and resets players', async ({ page }) => {
    const createdSeasonIds: string[] = []
    try {
      await restoreBaseline(baseSeasonId)
      await db()`UPDATE seasons SET status = 'ended', ended_at = now() WHERE status = 'active'`

      const season = await createActiveSeason({ startingBalance: 200, buyIn: 100, maxSessions: 20, phase: 'steady' })
      createdSeasonIds.push(season.id)

      await db()`
        UPDATE players
        SET balance = CASE
          WHEN id = ${alice.id} THEN 730
          WHEN id = ${bob.id} THEN 410
          WHEN id = ${charlie.id} THEN 290
          ELSE balance
        END
        WHERE id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      `
      const balancesBefore = await db()`
        SELECT id, balance
        FROM players
        WHERE id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { id: string; balance: number }[]
      const beforeMap = new Map(balancesBefore.map((r) => [r.id, Number(r.balance)]))

      await page.goto(adminUrl(adminKey))
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Force end season' }).click()
      await expect(page.getByRole('button', { name: 'Yakin' })).toBeVisible()
      await page.getByRole('button', { name: 'Yakin' }).click()

      await expect.poll(async () => {
        const [row] = await db()`SELECT status FROM seasons WHERE id = ${season.id}` as { status: string }[]
        return row?.status ?? null
      }, { timeout: 20_000 }).toBe('ended')

      const [seasonAfter] = await db()`
        SELECT status, current_phase
        FROM seasons
        WHERE id = ${season.id}
      ` as { status: string; current_phase: string }[]
      expect(seasonAfter.status).toBe('ended')
      expect(seasonAfter.current_phase).toBe('steady')

      const resultRows = await db()`
        SELECT player_id, final_balance
        FROM season_results
        WHERE season_id = ${season.id}
          AND player_id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { player_id: string; final_balance: number }[]
      expect(resultRows).toHaveLength(3)
      for (const row of resultRows) {
        expect(Number(row.final_balance)).toBe(beforeMap.get(row.player_id))
      }

      const balancesAfter = await db()`
        SELECT id, balance
        FROM players
        WHERE id = ANY(${[alice.id, bob.id, charlie.id]}::uuid[])
      ` as { id: string; balance: number }[]
      for (const row of balancesAfter) {
        expect(Number(row.balance)).toBe(200)
      }
    } finally {
      for (const id of createdSeasonIds) {
        await cleanupSeason(id)
      }
      await restoreBaseline(baseSeasonId)
    }
  })
})
