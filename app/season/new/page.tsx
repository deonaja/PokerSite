export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SeasonSetup from '@/components/SeasonSetup'

async function getSeasonContext() {
  const [activeSeason, seasonCount, allPlayerRows, lastSeasonRows] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    sql`SELECT COUNT(*) as count FROM seasons`,
    // Checklist source = ALL registered players (robust — survives a season reset,
    // unlike the old season_results-based prefill that the carry-over bug hit).
    sql`SELECT id, name FROM players ORDER BY name ASC`,
    // Who was in the most recently ended season — used only for a "musim lalu"
    // tag (NOT pre-checked; default is uncheck-all per design).
    sql`
      SELECT player_id
      FROM season_results
      WHERE season_id = (
        SELECT id FROM seasons WHERE status = 'ended' ORDER BY number DESC LIMIT 1
      )
    `,
  ])

  const lastSeasonIds = new Set(
    (lastSeasonRows as { player_id: string }[]).map((r) => r.player_id)
  )
  const allPlayers = (allPlayerRows as { id: string; name: string }[]).map((p) => ({
    ...p,
    inLastSeason: lastSeasonIds.has(p.id),
  }))

  return {
    hasActiveSeason: activeSeason.length > 0,
    allPlayers,
    nextSeasonNumber: Number((seasonCount[0] as { count: string }).count) + 1,
  }
}

export default async function SeasonNewPage() {
  const { hasActiveSeason, allPlayers, nextSeasonNumber } = await getSeasonContext()

  if (hasActiveSeason) redirect('/')

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-[480px]">
        <SeasonSetup
          seasonNumber={nextSeasonNumber}
          allPlayers={allPlayers}
        />
      </div>
    </div>
  )
}
