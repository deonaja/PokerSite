import { resolve } from 'path'
import { writeFileSync } from 'fs'
import { config as loadDotenv } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

export interface SeasonSnapshot {
  preset_name: string | null
  starting_balance: number
  buy_in: number
  bb: number
  sb: number
  max_pool: number
  max_sessions: number
  rake_rate: number
  current_phase: string
}

export interface TestData {
  runId: number
  adminKey: string
  defaultPin: string
  seasonId: string
  seasonCreated: boolean
  // When we REUSE the owner's real active season, snapshot its config here so
  // teardown can restore it — otherwise our test overwrite (huge max_pool, etc.)
  // would corrupt the real season. null when we created a fresh test season or
  // the existing one already looks like a leftover test value.
  seasonSnapshot: SeasonSnapshot | null
  players: { id: string; name: string; balance: number }[]
}

// max_pool we set during tests so the phase never auto-flips. Used as a sentinel
// to detect a season left in test-state by a previous interrupted run.
const TEST_MAX_POOL = 100_000_000

async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not set — check .env.local')
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) throw new Error('ADMIN_KEY not set — check .env.local')

  const sql = neon(dbUrl)
  const runId = Date.now()

  // Clean up any stale active sessions from previous test runs
  await sql`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
  console.log('[setup] Cleared any stale active sessions')

  const names = ['Alice', 'Bob', 'Charlie']
  const defaultPin = '1234'
  const players: TestData['players'] = []

  for (const shortName of names) {
    const fullName = `[T${runId}] ${shortName}`
    const pinHash = await hashPin(defaultPin)
    const rows = await sql`
      INSERT INTO players (name, balance, pin_hash) VALUES (${fullName}, 500, ${pinHash})
      RETURNING id, name, balance
    ` as { id: string; name: string; balance: number }[]
    players.push(rows[0])
  }

  // Ensure an active season exists so (main)/layout doesn't redirect to /season/new.
  // Reuse an existing active season if present (partial unique index allows only one).
  // buy_in 100 matches the historical hardcoded value test assertions rely on.
  // max_pool is huge so the phase never auto-transitions to 'steady' mid-test.
  let seasonId: string
  let seasonCreated: boolean
  let seasonSnapshot: SeasonSnapshot | null = null
  const existingSeason = await sql`
    SELECT id, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase
    FROM seasons WHERE status = 'active' LIMIT 1
  ` as (SeasonSnapshot & { id: string })[]
  if (existingSeason.length > 0) {
    seasonId = existingSeason[0].id
    seasonCreated = false
    // Snapshot the real config so teardown can restore it. Skip if it already
    // looks like a leftover test value (interrupted run) — restoring that would
    // just re-corrupt it; better to leave the snapshot null.
    if (existingSeason[0].max_pool !== TEST_MAX_POOL) {
      const { id: _id, ...snap } = existingSeason[0]
      seasonSnapshot = snap
    }
    await sql`
      UPDATE seasons
      SET starting_balance = 200, buy_in = 100, bb = 10, sb = 5,
          max_pool = ${TEST_MAX_POOL}, max_sessions = 100000, rake_rate = 10,
          current_phase = 'bootstrap', preset_name = 'standard'
      WHERE id = ${seasonId}
    `
    console.log(
      seasonSnapshot
        ? '[setup] Reused existing active season (config snapshotted for restore)'
        : '[setup] Reused existing active season (no snapshot — already test-state)'
    )
  } else {
    const seasonRows = await sql`
      INSERT INTO seasons
        (number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase)
      VALUES (
        (SELECT COALESCE(MAX(number), 0) + 1 FROM seasons),
        'active', 'standard', 200, 100, 10, 5, 100000000, 100000, 10, 'bootstrap'
      )
      RETURNING id
    ` as { id: string }[]
    seasonId = seasonRows[0].id
    seasonCreated = true
    console.log('[setup] Created active test season')
  }

  // Membership (migration 007): roster reads (dashboard/poll/setup/leaderboard)
  // scope to season_players, so the test players must JOIN the active season or
  // they'd be invisible. Backfill only ran once at migrate time; freshly-seeded
  // [T…] players are not auto-added, so add them here. Cascades on teardown.
  await sql`
    INSERT INTO season_players (season_id, player_id)
    SELECT ${seasonId}, id FROM players WHERE id = ANY(${players.map((p) => p.id)}::uuid[])
    ON CONFLICT DO NOTHING
  `
  console.log('[setup] Added test players to active season roster (season_players)')

  const data: TestData = { runId, adminKey, defaultPin, seasonId, seasonCreated, seasonSnapshot, players }
  writeFileSync(resolve(process.cwd(), '.test-data.json'), JSON.stringify(data, null, 2))
  console.log(`\n[setup] Created ${players.length} test players (runId: ${runId})`)
}

export default globalSetup
