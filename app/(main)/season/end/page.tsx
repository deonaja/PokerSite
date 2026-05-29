import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SeasonEndConfirm from './SeasonEndConfirm'

interface SeasonRow {
  id: string
  number: number
  status: string
  starting_balance: number
  max_sessions: number
  preset_name: string | null
  sessions_played: number
}

interface PlayerRow {
  id: string
  name: string
  balance: number
}

async function getData(seasonId: string) {
  const [seasonRows, playerRows] = await Promise.all([
    sql`
      SELECT
        se.id,
        se.number,
        se.status,
        se.starting_balance,
        se.max_sessions,
        se.preset_name,
        COUNT(s.id) FILTER (WHERE s.status = 'ended')::int AS sessions_played
      FROM seasons se
      LEFT JOIN sessions s ON s.season_id = se.id
      WHERE se.id = ${seasonId}
      GROUP BY se.id
    ` as unknown as Promise<SeasonRow[]>,
    sql`
      SELECT id, name, balance
      FROM players
      ORDER BY balance DESC, name ASC
    ` as unknown as Promise<PlayerRow[]>,
  ])

  const season = (await seasonRows)[0] ?? null
  const players = await playerRows
  return { season, players }
}

export default async function SeasonEndPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) notFound()

  const { season, players } = await getData(id)
  if (!season) notFound()

  // If someone manually navigates here after season is already ended, redirect home.
  if (season.status === 'ended') redirect('/')

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent-warn)', marginBottom: '0.25rem' }}>
          MUSIM #{season.number} SELESAI
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
          {season.sessions_played} dari {season.max_sessions} sesi
          {season.preset_name ? ` · ${season.preset_name}` : ''}
        </p>
      </div>

      <div style={{ padding: '1.25rem 1rem 0' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
          LEADERBOARD
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {players.map((p, i) => {
            const delta = p.balance - season.starting_balance
            const rank = i + 1
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${rank === 1 ? 'var(--accent-warn)' : 'var(--border-subtle)'}`,
                  background: 'var(--bg-surface)',
                }}
              >
                <span style={{
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  color: rank === 1 ? 'var(--accent-warn)' : 'var(--text-tertiary)',
                  width: '1.5rem',
                  flexShrink: 0,
                }}>
                  #{rank}
                </span>
                <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                  }}>
                    {p.balance}
                  </span>
                  <span style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '0.75rem',
                    color: delta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                  }}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--accent-danger)',
          background: 'var(--bg-surface)',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--accent-warn)', margin: '0 0 0.25rem', fontWeight: 500 }}>
            Setelah konfirmasi:
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Semua balance akan di-reset ke <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{season.starting_balance}</span>.
            Hasil musim ini akan di-snapshot. Musim baru siap dimulai.
          </p>
        </div>
      </div>

      <SeasonEndConfirm seasonId={season.id} />
    </div>
  )
}
