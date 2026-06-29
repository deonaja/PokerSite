// Progressive 3-tier achievement definitions + evaluator. Each category has
// three milestones (tier 1/2/3) with their own name. Player accrues lifetime
// progress on a category metric and unlocks each tier as the count crosses
// the threshold. Tiers persist as separate rows in player_achievements
// (player_id, achievement_key=categoryId, tier).
//
// Order in ACHIEVEMENTS = display order. Icon visuals live in
// components/AchievementIcon.tsx, keyed by category id.

export type AchievementMetric =
  | 'dealer_count'    // lifetime times dealer (sum across all ended sessions)
  | 'rank_1_count'    // lifetime musim finished #1
  | 'top_3_count'     // lifetime musim finished rank <= 3
  | 'seasons_played'  // lifetime musim row count
  | 'sultan_count'    // lifetime musim where final_balance >= 2 * starting_balance
  | 'profit_count'    // lifetime musim where total_won > total_lost

export interface AchievementTier {
  tier: 1 | 2 | 3
  name: string         // tier-specific name, e.g. "Bandar Lokal"
  description: string  // e.g. "Jadi dealer 15× lifetime"
  threshold: number    // minimum metric count to earn this tier
}

export interface AchievementCategory {
  id: string           // stable identifier: 'bandar' | 'juara' | 'podium' | 'veteran' | 'sultan' | 'untung'
  emoji: string        // legacy fallback; UI prefers AchievementIcon SVG
  metric: AchievementMetric
  tiers: [AchievementTier, AchievementTier, AchievementTier]
}

export const ACHIEVEMENTS: AchievementCategory[] = [
  {
    id: 'bandar',
    emoji: '🃏',
    metric: 'dealer_count',
    tiers: [
      { tier: 1, name: 'Bandar Lokal', description: 'Jadi dealer 15× lifetime', threshold: 15 },
      { tier: 2, name: 'Bandar Senior', description: 'Jadi dealer 30× lifetime', threshold: 30 },
      { tier: 3, name: 'Mafia Bandar', description: 'Jadi dealer 50× lifetime', threshold: 50 },
    ],
  },
  {
    id: 'juara',
    emoji: '🏆',
    metric: 'rank_1_count',
    tiers: [
      { tier: 1, name: 'Juara Pertama', description: 'Finish #1 di sebuah musim', threshold: 1 },
      { tier: 2, name: 'Beruntun', description: 'Finish #1 di 3 musim', threshold: 3 },
      { tier: 3, name: 'Raja Meja', description: 'Finish #1 di 5 musim', threshold: 5 },
    ],
  },
  {
    id: 'podium',
    emoji: '🥈',
    metric: 'top_3_count',
    tiers: [
      { tier: 1, name: 'Naik Podium', description: 'Finish 3 besar di sebuah musim', threshold: 1 },
      { tier: 2, name: 'Veteran Podium', description: 'Finish 3 besar di 5 musim', threshold: 5 },
      { tier: 3, name: 'Selalu Atas', description: 'Finish 3 besar di 10 musim', threshold: 10 },
    ],
  },
  {
    id: 'veteran',
    emoji: '🎖️',
    metric: 'seasons_played',
    tiers: [
      { tier: 1, name: 'Pemula', description: 'Selesaikan 1 musim', threshold: 1 },
      { tier: 2, name: 'Loyalis', description: 'Selesaikan 5 musim', threshold: 5 },
      { tier: 3, name: 'Saksi Sejarah', description: 'Selesaikan 10 musim', threshold: 10 },
    ],
  },
  {
    id: 'sultan',
    emoji: '💰',
    metric: 'sultan_count',
    tiers: [
      { tier: 1, name: 'Sultan Sekali', description: 'Saldo akhir ≥ 2× modal awal di sebuah musim', threshold: 1 },
      { tier: 2, name: 'Sultan Tetap', description: 'Saldo akhir ≥ 2× modal awal di 3 musim', threshold: 3 },
      { tier: 3, name: 'Sultan Sejati', description: 'Saldo akhir ≥ 2× modal awal di 5 musim', threshold: 5 },
    ],
  },
  {
    id: 'untung',
    emoji: '📈',
    metric: 'profit_count',
    tiers: [
      { tier: 1, name: 'Untung Pertama', description: 'Total menang > kalah di sebuah musim', threshold: 1 },
      { tier: 2, name: 'Untung Konsisten', description: 'Total menang > kalah di 3 musim', threshold: 3 },
      { tier: 3, name: 'Untung Maestro', description: 'Total menang > kalah di 5 musim', threshold: 5 },
    ],
  },
]

export const ACHIEVEMENT_CATEGORY_IDS = ACHIEVEMENTS.map((a) => a.id)

// Lifetime counts (one number per category metric) used to derive tier.
export interface LifetimeCounts {
  dealer_count: number
  rank_1_count: number
  top_3_count: number
  seasons_played: number
  sultan_count: number
  profit_count: number
}

/**
 * Given a single lifetime count and a category, return the highest tier earned
 * (1, 2, or 3) — or 0 if the player hasn't crossed even the tier-1 threshold.
 */
export function computeTierForCount(count: number, category: AchievementCategory): 0 | 1 | 2 | 3 {
  // tiers are sorted by threshold ascending; walk from highest to lowest
  for (let i = category.tiers.length - 1; i >= 0; i--) {
    if (count >= category.tiers[i].threshold) return category.tiers[i].tier
  }
  return 0
}

/**
 * Given full lifetime counts, return a list of (categoryId, tier) pairs covering
 * every tier the player has crossed (so a player at count=4 in 'untung' returns
 * tiers [1, 3]). Used by endSeason for UPSERTing every earned tier idempotently.
 *
 * NB: thresholds are 1, 3, 5 etc., so crossing tier 3 implies tier 1 & 2 are
 * also earned — the function emits all three. This is what we want for the
 * (player_id, achievement_key, tier) UPSERT loop.
 */
export function getEarnedTiers(counts: LifetimeCounts): Array<{ categoryId: string; tier: 1 | 2 | 3 }> {
  const out: Array<{ categoryId: string; tier: 1 | 2 | 3 }> = []
  for (const cat of ACHIEVEMENTS) {
    const count = counts[cat.metric]
    for (const t of cat.tiers) {
      if (count >= t.threshold) out.push({ categoryId: cat.id, tier: t.tier })
    }
  }
  return out
}

/**
 * Helper used by the player-profile UI: given the player's stored
 * player_achievements rows (filtered to the categoryId already, ideally), return
 * the set of tier numbers earned.
 */
export function tiersEarnedForCategory(
  achievements: Array<{ achievement_key: string; tier: number }>,
  categoryId: string,
): Set<1 | 2 | 3> {
  const earned = new Set<1 | 2 | 3>()
  for (const a of achievements) {
    if (a.achievement_key === categoryId && (a.tier === 1 || a.tier === 2 || a.tier === 3)) {
      earned.add(a.tier)
    }
  }
  return earned
}

// ---------------------------------------------------------------------------
// Lifetime stat aggregator — pure & testable. Reads season_results-shaped rows
// PLUS an optional lifetime dealer_count override (because dealer count is
// derived from session_participants, not season_results — see endSeason).
// ---------------------------------------------------------------------------

export interface SeasonResultRow {
  rank: number
  final_balance: number
  sessions_played: number
  times_dealer: number
  total_won: number
  total_lost: number
  starting_balance: number
}

/**
 * Sums lifetime counts from season_results. dealer_count is summed from
 * times_dealer per row (it tracks how many sessions in that season the player
 * dealt) — which matches lifetime dealer total. Callers who want true
 * session_participants-derived dealer count can pass an override.
 */
export function computeLifetimeCounts(
  rows: SeasonResultRow[],
  dealerCountOverride?: number,
): LifetimeCounts {
  let dealer = 0
  let rank1 = 0
  let top3 = 0
  let sultan = 0
  let profit = 0
  for (const r of rows) {
    dealer += r.times_dealer
    if (r.rank === 1) rank1 += 1
    if (r.rank <= 3) top3 += 1
    if (r.starting_balance > 0 && r.final_balance >= 2 * r.starting_balance) sultan += 1
    if (r.total_won > r.total_lost) profit += 1
  }
  return {
    dealer_count: dealerCountOverride ?? dealer,
    rank_1_count: rank1,
    top_3_count: top3,
    seasons_played: rows.length,
    sultan_count: sultan,
    profit_count: profit,
  }
}

// ---------------------------------------------------------------------------
// Legacy export retained for any callers that still rely on the flat key list
// (e.g. UI fallbacks). Tier-1 names map back to the category ids.
// ---------------------------------------------------------------------------
export const ACHIEVEMENT_KEYS = ACHIEVEMENT_CATEGORY_IDS

/**
 * @deprecated Use computeLifetimeCounts + getEarnedTiers. Kept so callers in
 * tests / older code keep compiling. Returns the set of category ids the
 * player has earned at least tier 1 in.
 */
export function evaluateAchievements(rows: SeasonResultRow[]): string[] {
  const counts = computeLifetimeCounts(rows)
  const earned = new Set<string>()
  for (const cat of ACHIEVEMENTS) {
    if (computeTierForCount(counts[cat.metric], cat) >= 1) earned.add(cat.id)
  }
  return ACHIEVEMENT_CATEGORY_IDS.filter((id) => earned.has(id))
}
