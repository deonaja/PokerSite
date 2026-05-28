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
    <div style={{ paddingBottom: '6rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Link
          href="/"
          style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
        >
          ←
        </Link>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Setup sesi
        </span>
      </div>

      <SessionSetupForm players={players} buyIn={buyIn} currentPhase={currentPhase} />
    </div>
  )
}
