export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SeasonSetup from '@/components/SeasonSetup'

async function getSeasonContext() {
  const [activeSeason, players, seasonCount] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    sql`SELECT id, name FROM players ORDER BY name ASC`,
    sql`SELECT COUNT(*) as count FROM seasons`,
  ])
  return {
    hasActiveSeason: activeSeason.length > 0,
    existingPlayers: players as { id: string; name: string }[],
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
