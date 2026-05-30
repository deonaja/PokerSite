// M4 achievement definitions + evaluator. Achievements are derived from a
// player's season_results history; endSeason awards them (stored in
// player_achievements), and the player profile renders earned vs locked.

export interface AchievementDef {
  key: string
  emoji: string
  label: string
  description: string
}

// Order = display order.
export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'juara', emoji: '🏆', label: 'Juara', description: 'Finish peringkat #1 di sebuah musim' },
  { key: 'podium', emoji: '🥈', label: 'Podium', description: 'Finish 3 besar di sebuah musim' },
  { key: 'veteran', emoji: '🎖️', label: 'Veteran', description: 'Main di 3 musim atau lebih' },
  { key: 'raja_bandar', emoji: '🃏', label: 'Raja Bandar', description: 'Total jadi dealer 15 kali atau lebih' },
  { key: 'sultan', emoji: '💰', label: 'Sultan', description: 'Saldo akhir musim ≥ 1.5× saldo awal' },
  { key: 'musim_untung', emoji: '📈', label: 'Musim Untung', description: 'Punya musim dengan total menang > total kalah' },
]

export const ACHIEVEMENT_KEYS = ACHIEVEMENTS.map((a) => a.key)

// One row per (player, season) the player has results for.
export interface SeasonResultRow {
  rank: number
  final_balance: number
  sessions_played: number
  times_dealer: number
  total_won: number
  total_lost: number
  starting_balance: number
}

// Returns the set of achievement keys a player has earned given their full
// season-results history. Pure + deterministic so it can drive both awarding
// (endSeason) and backfill.
export function evaluateAchievements(rows: SeasonResultRow[]): string[] {
  const earned = new Set<string>()
  const played = rows.filter((r) => r.sessions_played > 0)

  if (rows.some((r) => r.rank === 1)) earned.add('juara')
  if (rows.some((r) => r.rank <= 3)) earned.add('podium')
  if (played.length >= 3) earned.add('veteran')
  if (rows.reduce((sum, r) => sum + r.times_dealer, 0) >= 15) earned.add('raja_bandar')
  if (rows.some((r) => r.starting_balance > 0 && r.final_balance >= r.starting_balance * 1.5)) earned.add('sultan')
  if (rows.some((r) => r.total_won > r.total_lost)) earned.add('musim_untung')

  // Preserve definition order.
  return ACHIEVEMENT_KEYS.filter((k) => earned.has(k))
}
