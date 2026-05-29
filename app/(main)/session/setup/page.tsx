import Link from 'next/link'
import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import SessionSetupForm from '@/components/SessionSetupForm'

interface PlayerWithMeta extends Player {
  cooldown_remaining: number
}

async function getSetupData(): Promise<{ players: PlayerWithMeta[]; buyIn: number; currentPhase: 'bootstrap' | 'steady' }> {
  const [playerRows, seasonRows] = await Promise.all([
    sql`
      SELECT
        p.id, p.name, p.balance, p.created_at, p.last_dealer_session_id,
        CASE
          WHEN p.last_dealer_session_id IS NULL THEN 0
          ELSE GREATEST(0, 2 - (
            SELECT COUNT(*) FROM sessions s
            WHERE s.started_at > (SELECT started_at FROM sessions WHERE id = p.last_dealer_session_id)
            AND s.status IN ('active', 'ended')
          ))
        END::int AS cooldown_remaining
      FROM players p
      ORDER BY p.name ASC
    `,
    sql`SELECT buy_in, current_phase FROM seasons WHERE status = 'active' LIMIT 1`,
  ])

  const seasonRow = seasonRows[0] as { buy_in: number; current_phase: string } | undefined
  const buyIn = seasonRow?.buy_in ?? 100
  const currentPhase = (seasonRow?.current_phase as 'bootstrap' | 'steady') ?? 'bootstrap'

  return {
    players: playerRows as unknown as PlayerWithMeta[],
    buyIn,
    currentPhase,
  }
}

export default async function SessionSetupPage() {
  const { players, buyIn, currentPhase } = await getSetupData()

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-lg leading-none text-muted-foreground"
        >
          ←
        </Link>
        <span className="text-sm font-medium text-foreground">Setup sesi</span>
      </div>

      <SessionSetupForm players={players} buyIn={buyIn} currentPhase={currentPhase} />
    </div>
  )
}
