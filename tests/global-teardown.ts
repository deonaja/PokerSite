import { resolve } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { config as loadDotenv } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import type { TestData } from './global-setup'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

async function globalTeardown() {
  const dataPath = resolve(process.cwd(), '.test-data.json')
  let data: TestData
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf-8')) as TestData
  } catch {
    console.warn('[teardown] No test data file found, skipping cleanup')
    return
  }

  const sql = neon(process.env.DATABASE_URL!)
  const playerIds = data.players.map((p) => p.id)

  // Find sessions that involve test players
  const sessionRows = await sql`
    SELECT DISTINCT sp.session_id
    FROM session_participants sp
    WHERE sp.player_id = ANY(${playerIds}::uuid[])
  ` as { session_id: string }[]
  const sessionIds = sessionRows.map((r) => r.session_id)

  if (sessionIds.length > 0) {
    await sql`DELETE FROM edit_log WHERE session_id = ANY(${sessionIds}::uuid[])`
    await sql`DELETE FROM session_participants WHERE session_id = ANY(${sessionIds}::uuid[])`
    await sql`DELETE FROM sessions WHERE id = ANY(${sessionIds}::uuid[])`
  }

  // Delete edit logs tied directly to test players (admin actions)
  await sql`DELETE FROM edit_log WHERE player_id = ANY(${playerIds}::uuid[])`

  // Delete test players
  await sql`DELETE FROM players WHERE id = ANY(${playerIds}::uuid[])`

  unlinkSync(dataPath)
  console.log(`[teardown] Cleaned up test data (runId: ${data.runId})`)
}

export default globalTeardown
