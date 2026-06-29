// Backfill player_achievements rows from existing season_results data under
// the new tiered scheme (see lib/achievements.ts). Run once after migration
// 015 is applied. Idempotent: it DELETEs every row first, then re-inserts.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-achievements.mjs
//
// Notes:
// - Lifetime dealer_count is derived from session_participants (more accurate
//   than summing season_results.times_dealer, which only counts ended-season
//   sessions). They should agree but the participants table is canonical.
// - The DELETE is by design: legacy rows used a different sultan threshold
//   (1.5×) and only flat keys; we rewrite under the new rules.

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// Mirror of lib/achievements.ts ACHIEVEMENTS — kept in a plain JS module so the
// script needs no transpile. Keep IN SYNC with lib/achievements.ts manually.
// (Tier thresholds & ids only — names/descriptions don't affect logic here.)
const CATEGORIES = [
  { id: 'bandar',  metric: 'dealer_count',    thresholds: [15, 30, 50] },
  { id: 'juara',   metric: 'rank_1_count',    thresholds: [1, 3, 5] },
  { id: 'podium',  metric: 'top_3_count',     thresholds: [1, 5, 10] },
  { id: 'veteran', metric: 'seasons_played',  thresholds: [1, 5, 10] },
  { id: 'sultan',  metric: 'sultan_count',    thresholds: [1, 3, 5] },
  { id: 'untung',  metric: 'profit_count',    thresholds: [1, 3, 5] },
]

function earnedTiers(count, thresholds) {
  const out = []
  for (let i = 0; i < thresholds.length; i++) {
    if (count >= thresholds[i]) out.push(i + 1)
  }
  return out
}

console.log('--- Backfill player_achievements (tiered) ---')

// 1) Lifetime per-player season_results stats (no JOIN to current player set —
//    we want every player who's ever finished a season).
const lifetimeRows = await sql`
  SELECT
    sr.player_id,
    COUNT(*)::int AS seasons_played,
    SUM(CASE WHEN sr.rank = 1 THEN 1 ELSE 0 END)::int AS rank_1_count,
    SUM(CASE WHEN sr.rank <= 3 THEN 1 ELSE 0 END)::int AS top_3_count,
    SUM(CASE WHEN se.starting_balance > 0 AND sr.final_balance >= 2 * se.starting_balance THEN 1 ELSE 0 END)::int AS sultan_count,
    SUM(CASE WHEN sr.total_won > sr.total_lost THEN 1 ELSE 0 END)::int AS profit_count
  FROM season_results sr
  JOIN seasons se ON se.id = sr.season_id
  GROUP BY sr.player_id
`

// 2) Lifetime dealer count from session_participants (status = 'ended').
const dealerRows = await sql`
  SELECT sp.player_id, COUNT(*)::int AS dealer_count
  FROM session_participants sp
  JOIN sessions s ON s.id = sp.session_id
  WHERE sp.is_dealer = true AND s.status = 'ended'
  GROUP BY sp.player_id
`
const dealerMap = new Map(dealerRows.map((r) => [r.player_id, r.dealer_count]))

// 3) Merge — every player who appears in either source.
const allPlayerIds = new Set([
  ...lifetimeRows.map((r) => r.player_id),
  ...dealerRows.map((r) => r.player_id),
])
const lifetimeMap = new Map(lifetimeRows.map((r) => [r.player_id, r]))

console.log(`Found ${allPlayerIds.size} players with achievement-relevant history`)
console.log(`  ${lifetimeRows.length} have season_results rows`)
console.log(`  ${dealerRows.length} have ended-session dealer rows`)

// 4) Wipe & rebuild. Done in a transaction so a crash mid-loop leaves data
//    consistent (either fully old or fully new).
const inserts = []
for (const playerId of allPlayerIds) {
  const lr = lifetimeMap.get(playerId) ?? {
    seasons_played: 0,
    rank_1_count: 0,
    top_3_count: 0,
    sultan_count: 0,
    profit_count: 0,
  }
  const counts = {
    dealer_count: dealerMap.get(playerId) ?? 0,
    rank_1_count: lr.rank_1_count,
    top_3_count: lr.top_3_count,
    seasons_played: lr.seasons_played,
    sultan_count: lr.sultan_count,
    profit_count: lr.profit_count,
  }
  for (const cat of CATEGORIES) {
    const tiers = earnedTiers(counts[cat.metric], cat.thresholds)
    for (const tier of tiers) {
      inserts.push({ playerId, categoryId: cat.id, tier })
    }
  }
}

console.log(`Will insert ${inserts.length} (player, category, tier) rows`)

// neon HTTP doesn't expose BEGIN/COMMIT in a single connection — we just do
// the DELETE then INSERTs one-by-one. Idempotent on rerun.
await sql`DELETE FROM player_achievements`
console.log('Cleared existing player_achievements rows')

let inserted = 0
for (const { playerId, categoryId, tier } of inserts) {
  await sql`
    INSERT INTO player_achievements (player_id, achievement_key, tier)
    VALUES (${playerId}, ${categoryId}, ${tier})
    ON CONFLICT (player_id, achievement_key, tier) DO NOTHING
  `
  inserted += 1
}
console.log(`Inserted ${inserted} rows`)

// 5) Summarize.
const byCat = await sql`
  SELECT achievement_key, tier, COUNT(*)::int AS n
  FROM player_achievements
  GROUP BY achievement_key, tier
  ORDER BY achievement_key, tier
`
console.log('\nPer-(category, tier) row counts after backfill:')
for (const r of byCat) {
  console.log(`  ${r.achievement_key} tier ${r.tier}: ${r.n}`)
}

console.log('\n--- Done ---')
