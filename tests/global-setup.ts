import { resolve } from 'path'
import { writeFileSync } from 'fs'
import { config as loadDotenv } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

export interface TestData {
  runId: number
  adminKey: string
  defaultPin: string
  seasonId: string
  seasonCreated: boolean
  players: { id: string; name: string; balance: number }[]
}

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
  const existingSeason = await sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1` as { id: string }[]
  if (existingSeason.length > 0) {
    seasonId = existingSeason[0].id
    seasonCreated = false
    await sql`
      UPDATE seasons
      SET starting_balance = 200, buy_in = 100, bb = 10, sb = 5,
          max_pool = 100000000, max_sessions = 100000, rake_rate = 10,
          current_phase = 'bootstrap', preset_name = 'standard'
      WHERE id = ${seasonId}
    `
    console.log('[setup] Reused existing active season')
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

  const data: TestData = { runId, adminKey, defaultPin, seasonId, seasonCreated, players }
  writeFileSync(resolve(process.cwd(), '.test-data.json'), JSON.stringify(data, null, 2))
  console.log(`\n[setup] Created ${players.length} test players (runId: ${runId})`)
}

export default globalSetup
