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

  // Clear dealer references first — players.last_dealer_session_id has no ON DELETE,
  // so it would block session deletion below.
  await sql`UPDATE players SET last_dealer_session_id = NULL WHERE id = ANY(${playerIds}::uuid[])`

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

  // Also delete any stray test players created during tests (e.g. via admin UI)
  // that weren't tracked in test-data.json — identifiable by the [T...] name prefix
  const strayPlayers = await sql`SELECT id FROM players WHERE name LIKE '[T%'` as { id: string }[]
  if (strayPlayers.length > 0) {
    const strayIds = strayPlayers.map(p => p.id)
    await sql`UPDATE players SET last_dealer_session_id = NULL WHERE id = ANY(${strayIds}::uuid[])`
    const straySessions = await sql`
      SELECT DISTINCT session_id FROM session_participants
      WHERE player_id = ANY(${strayIds}::uuid[])
    ` as { session_id: string }[]
    if (straySessions.length > 0) {
      const straySessionIds = straySessions.map(r => r.session_id)
      await sql`DELETE FROM edit_log WHERE session_id = ANY(${straySessionIds}::uuid[])`
      await sql`DELETE FROM session_participants WHERE session_id = ANY(${straySessionIds}::uuid[])`
      await sql`DELETE FROM sessions WHERE id = ANY(${straySessionIds}::uuid[])`
    }
    await sql`DELETE FROM edit_log WHERE player_id = ANY(${strayIds}::uuid[])`
    await sql`DELETE FROM players WHERE id = ANY(${strayIds}::uuid[])`
    console.log(`[teardown] Deleted ${strayPlayers.length} stray test player(s)`)
  }

  // Delete the test season only if setup created it (don't touch a pre-existing one).
  // Sessions referencing it are already gone by now; wrap in try/catch as a safety net.
  if (data.seasonCreated && data.seasonId) {
    try {
      await sql`DELETE FROM edit_log WHERE session_id IS NULL AND metadata->>'season_id' = ${data.seasonId}`
      await sql`DELETE FROM seasons WHERE id = ${data.seasonId}`
      console.log('[teardown] Deleted test season')
    } catch (e) {
      console.warn('[teardown] Could not delete test season (still referenced?):', e)
    }
  }

  unlinkSync(dataPath)
  console.log(`[teardown] Cleaned up test data (runId: ${data.runId})`)
}

export default globalTeardown
