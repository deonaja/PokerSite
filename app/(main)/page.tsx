import Link from 'next/link'
import { sql } from '@/lib/db'
import type { Player, Session } from '@/lib/types'
import PlayerCard from '@/components/PlayerCard'
import Button from '@/components/Button'

async function getDashboardData() {
  const [players, sessions] = await Promise.all([
    sql`SELECT id, name, balance, created_at FROM players ORDER BY name ASC`,
    sql`SELECT id, dealer_id, status, started_at FROM sessions WHERE status = 'active' LIMIT 1`,
  ])
  return {
    players: players as Player[],
    activeSession: (sessions[0] ?? null) as Session | null,
  }
}

export default async function DashboardPage() {
  const { players, activeSession } = await getDashboardData()

  return (
    <div style={{ paddingBottom: '6rem' }}>
      {/* Player list */}
      <div style={{ padding: '1.5rem 1rem 0' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
            marginBottom: '0.75rem',
          }}
        >
          PEMAIN
        </p>

        {players.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Belum ada pemain terdaftar.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        )}
      </div>

      {/* Active session card */}
      {activeSession && (
        <div style={{ padding: '1rem 1rem 0' }}>
          <Link
            href="/session"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--accent-felt)',
              background: 'var(--accent-felt-dim)',
              textDecoration: 'none',
              minHeight: '44px',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Sesi sedang berjalan — tap untuk lanjut
            </span>
          </Link>
        </div>
      )}

      {/* Sticky CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '480px',
          padding: '0.75rem 1rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
        }}
      >
        {activeSession ? (
          <Button fullWidth disabled>
            Mulai sesi
          </Button>
        ) : (
          <Link href="/session/setup" style={{ display: 'block' }}>
            <Button fullWidth>Mulai sesi</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
