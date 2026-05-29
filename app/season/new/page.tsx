export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SeasonSetup from '@/components/SeasonSetup'

async function getSeasonContext() {
  const [activeSeason, seasonCount] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    sql`SELECT COUNT(*) as count FROM seasons`,
  ])

  // Pre-fill from the most recently ended season (ranked order), not all players.
  const lastSeasonPlayers = await sql`
    SELECT p.id, p.name
    FROM season_results sr
    JOIN players p ON p.id = sr.player_id
    WHERE sr.season_id = (
      SELECT id FROM seasons WHERE status = 'ended' ORDER BY number DESC LIMIT 1
    )
    ORDER BY sr.rank ASC
  `

  return {
    hasActiveSeason: activeSeason.length > 0,
    existingPlayers: lastSeasonPlayers as { id: string; name: string }[],
    nextSeasonNumber: Number((seasonCount[0] as { count: string }).count) + 1,
  }
}

export default async function SeasonNewPage() {
  const { hasActiveSeason, existingPlayers, nextSeasonNumber } = await getSeasonContext()

  if (hasActiveSeason) redirect('/')

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--bg-base)' }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <SeasonSetup
          seasonNumber={nextSeasonNumber}
          existingPlayers={existingPlayers}
        />
      </div>
    </div>
  )
}
