'use client'

import Link from 'next/link'
import { usePoll } from '@/lib/usePoll'
import PlayerCard from './PlayerCard'
import Button from './Button'
import type { PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
}

export default function DashboardClient({ initial, season }: Props) {
  const { players, activeSession } = usePoll(initial)

  return (
    <div style={{ paddingBottom: '6rem' }}>
      {/* Season info */}
      {season && (
        <div style={{ padding: '1rem 1rem 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.875rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Season {season.number}
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                padding: '1px 5px',
                borderRadius: '4px',
                background: season.current_phase === 'steady' ? 'var(--accent-warn)' : 'var(--accent-felt)',
                color: 'var(--text-primary)',
              }}>
                {season.current_phase === 'steady' ? 'STEADY' : 'BOOTSTRAP'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <span>buy-in {season.buy_in}</span>
              <span>BB {season.bb}</span>
            </div>
          </div>
        </div>
      )}

      {/* History link */}
      <div style={{ padding: '0.5rem 1rem 0', textAlign: 'right' }}>
        <Link href="/season/history" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          Riwayat musim →
        </Link>
      </div>

      {/* Player list */}
      <div style={{ padding: '1rem 1rem 0' }}>
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
