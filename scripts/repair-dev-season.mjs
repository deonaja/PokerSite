// One-off repair for the DEV/test Neon DB after a `pnpm test` run left the active
// season with no season_players (post-007 the dashboard scopes to membership) and
// a test-sentinel config (max_pool 100,000,000). Re-adds the real players to the
// active season's roster, restores a sane season config, and resets real-player
// balances to starting_balance for a clean dev state. Test ([T…]) players are left
// out. Run: node --env-file=.env.local scripts/repair-dev-season.mjs
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const [active] = await sql`
  SELECT id, number, max_pool, max_sessions, buy_in, starting_balance, current_phase
  FROM seasons WHERE status = 'active' LIMIT 1`
if (!active) {
  console.error('No active season — nothing to repair.')
  process.exit(1)
}
console.log('Active season BEFORE:', active)

const playersBefore = await sql`SELECT name, balance FROM players WHERE name NOT LIKE '[T%' ORDER BY name`
console.log('Real players BEFORE:', playersBefore.map((p) => `${p.name}=${p.balance}`).join(', '))
const [{ c: membersBefore }] = await sql`SELECT COUNT(*)::int AS c FROM season_players WHERE season_id = ${active.id}`
console.log('Member rows BEFORE:', membersBefore)

// 1) Re-add every real (non-test) player to the active season's roster.
await sql`
  INSERT INTO season_players (season_id, player_id)
  SELECT ${active.id}, id FROM players WHERE name NOT LIKE '[T%'
  ON CONFLICT DO NOTHING`

// 2) Restore a sane season config (the test run left the 100M sentinel).
await sql`
  UPDATE seasons
  SET buy_in = 100, bb = 10, sb = 5, starting_balance = 500,
      max_pool = 3700, max_sessions = 24, rake_rate = 10,
      preset_name = 'standard', current_phase = 'bootstrap'
  WHERE id = ${active.id}`

// 3) Clean dev start: reset real players to starting_balance.
await sql`UPDATE players SET balance = 500 WHERE name NOT LIKE '[T%'`

const membersAfter = await sql`
  SELECT p.name, p.balance
  FROM season_players sp JOIN players p ON p.id = sp.player_id
  WHERE sp.season_id = ${active.id} ORDER BY p.name`
const [seasonAfter] = await sql`
  SELECT number, max_pool, max_sessions, buy_in, starting_balance, current_phase
  FROM seasons WHERE id = ${active.id}`
console.log('\n=== AFTER ===')
console.log('Season:', seasonAfter)
console.log('Members:', membersAfter.map((m) => `${m.name}=${m.balance}`).join(', ') || '(none)')
console.log('\nDone. Reload the dashboard.')
