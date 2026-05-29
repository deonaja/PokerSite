import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import BalanceDisplay from '@/components/BalanceDisplay'

interface PlayerRow {
  id: string
  name: string
  balance: number
}

interface ResultRow {
  season_id: string
  season_number: number
  preset_name: string | null
  starting_balance: number
  final_balance: number
  rank: number
  sessions_played: number
  times_dealer: number
  total_won: number
  total_lost: number
  ended_at: string | null
}

async function getData(id: string) {
  const [playerRows, resultRows] = await Promise.all([
    sql`SELECT id, name, balance FROM players WHERE id = ${id}` as unknown as Promise<PlayerRow[]>,
    sql`
      SELECT
        sr.season_id,
        se.number AS season_number,
        se.preset_name,
        se.starting_balance,
        sr.final_balance,
        sr.rank,
        sr.sessions_played,
        sr.times_dealer,
        sr.total_won,
        sr.total_lost,
        se.ended_at
      FROM season_results sr
      JOIN seasons se ON se.id = sr.season_id
      WHERE sr.player_id = ${id}
      ORDER BY se.number DESC
    ` as unknown as Promise<ResultRow[]>,
  ])

  const player = (await playerRows)[0] ?? null
  const results = await resultRows
  return { player, results }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { player, results } = await getData(id)
  if (!player) notFound()

  const totalSeasons = results.length
  const bestRank = totalSeasons > 0 ? Math.min(...results.map((r) => r.rank)) : null
  const totalSessions = results.reduce((s, r) => s + r.sessions_played, 0)
  const totalTimesDealer = results.reduce((s, r) => s + r.times_dealer, 0)
  const totalWon = results.reduce((s, r) => s + r.total_won, 0)
  const totalLost = results.reduce((s, r) => s + r.total_lost, 0)

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link
          href="/"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.125rem', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          ←
        </Link>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{player.name}</p>
        </div>
        <BalanceDisplay balance={player.balance} />
      </div>

      <div style={{ padding: '1.25rem 1rem 0' }}>
        {/* Overall stats */}
        {totalSeasons > 0 && (
          <>
            <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
              STATISTIK KESELURUHAN
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginBottom: '1.5rem',
            }}>
              <StatBox label="Musim dimainkan" value={totalSeasons} />
              <StatBox label="Rank terbaik" value={bestRank !== null ? `#${bestRank}` : '—'} />
              <StatBox label="Total sesi" value={totalSessions} />
              <StatBox label="Jadi dealer" value={totalTimesDealer} />
              <StatBox label="Total menang" value={totalWon} mono positive />
              <StatBox label="Total kalah" value={totalLost} mono negative />
            </div>
          </>
        )}

        {/* Per-season breakdown */}
        <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
          PER MUSIM
        </p>

        {results.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Belum ada musim selesai.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((r) => {
              const delta = r.final_balance - r.starting_balance
              return (
                <div key={r.season_id} style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${r.rank === 1 ? 'var(--accent-warn)' : 'var(--border-subtle)'}`,
                  background: 'var(--bg-surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Musim #{r.season_number}
                    </span>
                    {r.preset_name && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{r.preset_name}</span>
                    )}
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: r.rank === 1 ? 'var(--accent-warn)' : 'var(--text-tertiary)',
                    }}>
                      #{r.rank}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {r.sessions_played} sesi · {r.times_dealer}× dealer
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'block',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                      }}>
                        {r.final_balance}
                      </span>
                      <span style={{
                        display: 'block',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '0.6875rem',
                        color: delta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                      }}>
                        {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                  </div>

                  {r.ended_at && (
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', margin: '0.375rem 0 0' }}>
                      {formatDate(r.ended_at)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, mono, positive, negative }: {
  label: string
  value: string | number
  mono?: boolean
  positive?: boolean
  negative?: boolean
}) {
  const color = positive ? 'var(--accent-success)' : negative ? 'var(--accent-danger)' : 'var(--text-primary)'
  return (
    <div style={{
      padding: '0.75rem',
      borderRadius: '8px',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
    }}>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', margin: '0 0 0.25rem', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{
        fontSize: '1.125rem',
        fontWeight: 500,
        color,
        margin: 0,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      }}>
        {value}
      </p>
    </div>
  )
}
