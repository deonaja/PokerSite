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
    // A real player may reference a test session as their last dealt session.
    await sql`UPDATE players SET last_dealer_session_id = NULL WHERE last_dealer_session_id = ANY(${sessionIds}::uuid[])`
    await sql`DELETE FROM edit_log WHERE session_id = ANY(${sessionIds}::uuid[])`
    await sql`DELETE FROM session_participants WHERE session_id = ANY(${sessionIds}::uuid[])`
    await sql`DELETE FROM sessions WHERE id = ANY(${sessionIds}::uuid[])`
  }

  // Delete edit logs tied directly to test players (admin actions)
  await sql`DELETE FROM edit_log WHERE player_id = ANY(${playerIds}::uuid[])`

  // season_results FK-references players (M3) — must go before deleting players.
  await sql`DELETE FROM season_results WHERE player_id = ANY(${playerIds}::uuid[])`

  // loans FK-reference players (no ON DELETE CASCADE) — must go before players.
  await sql`DELETE FROM loans WHERE lender_id = ANY(${playerIds}::uuid[]) OR borrower_id = ANY(${playerIds}::uuid[])`

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
    // Sessions where a stray player was the dealer (not just a participant).
    const strayDealerSessions = await sql`
      SELECT id AS session_id FROM sessions WHERE dealer_id = ANY(${strayIds}::uuid[])
    ` as { session_id: string }[]
    const straySessionIds = [
      ...new Set([...straySessions, ...strayDealerSessions].map((r) => r.session_id)),
    ]
    if (straySessionIds.length > 0) {
      await sql`UPDATE players SET last_dealer_session_id = NULL WHERE last_dealer_session_id = ANY(${straySessionIds}::uuid[])`
      await sql`DELETE FROM edit_log WHERE session_id = ANY(${straySessionIds}::uuid[])`
      await sql`DELETE FROM session_participants WHERE session_id = ANY(${straySessionIds}::uuid[])`
      await sql`DELETE FROM sessions WHERE id = ANY(${straySessionIds}::uuid[])`
    }
    await sql`DELETE FROM edit_log WHERE player_id = ANY(${strayIds}::uuid[])`
    // season_results FK-references players (M3) — must go before deleting players.
    await sql`DELETE FROM season_results WHERE player_id = ANY(${strayIds}::uuid[])`
    // loans FK-reference players (no cascade) — must go before players.
    await sql`DELETE FROM loans WHERE lender_id = ANY(${strayIds}::uuid[]) OR borrower_id = ANY(${strayIds}::uuid[])`
    await sql`DELETE FROM players WHERE id = ANY(${strayIds}::uuid[])`
    console.log(`[teardown] Deleted ${strayPlayers.length} stray test player(s)`)
  }

  // Restore the owner's real season config that setup overwrote (huge max_pool,
  // etc.). Only set when we reused an existing season — see global-setup.
  if (data.seasonSnapshot) {
    const s = data.seasonSnapshot
    await sql`
      UPDATE seasons
      SET preset_name = ${s.preset_name},
          starting_balance = ${s.starting_balance},
          buy_in = ${s.buy_in},
          bb = ${s.bb},
          sb = ${s.sb},
          max_pool = ${s.max_pool},
          max_sessions = ${s.max_sessions},
          rake_rate = ${s.rake_rate},
          current_phase = ${s.current_phase}
      WHERE id = ${data.seasonId}
    `
    console.log('[teardown] Restored real season config')
  }

  // Restore the base season's real-player membership. Tests can wipe season_players
  // (debug ops / FK cascade on deletes); post-007 an empty roster bricks the
  // dashboard. Only for a reused season (a fresh test season is deleted below).
  // The JOIN to players guards against ids that no longer exist.
  if (!data.seasonCreated && data.seasonMemberIds?.length) {
    await sql`
      INSERT INTO season_players (season_id, player_id)
      SELECT ${data.seasonId}, id
      FROM players
      WHERE id = ANY(${data.seasonMemberIds}::uuid[])
      ON CONFLICT DO NOTHING
    `
    console.log(`[teardown] Restored ${data.seasonMemberIds.length} real member(s) to base season`)
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
