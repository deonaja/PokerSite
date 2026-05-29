'use client'

import { useState } from 'react'

interface SeasonResult {
  player_id: string
  player_name: string
  final_balance: number
  rank: number
  sessions_played: number
  times_dealer: number
  total_won: number
  total_lost: number
}

interface Season {
  id: string
  number: number
  preset_name: string | null
  starting_balance: number
  max_sessions: number
  sessions_played: number
  started_at: string
  ended_at: string | null
  results: SeasonResult[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SeasonCard({ season }: { season: Season }) {
  const [open, setOpen] = useState(false)
  const winner = season.results[0]

  return (
    <div style={{
      borderRadius: '8px',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: '44px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.125rem' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Musim #{season.number}
            </span>
            {season.preset_name && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                {season.preset_name}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            {season.sessions_played} sesi
            {season.ended_at ? ` · ${formatDate(season.ended_at)}` : ''}
            {winner ? ` · 🏆 ${winner.player_name}` : ''}
          </div>
        </div>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expandable leaderboard */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.75rem 1rem' }}>
          {season.results.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>Tidak ada data hasil.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {season.results.map((r) => {
                const delta = r.final_balance - season.starting_balance
                return (
                  <div
                    key={r.player_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: r.rank === 1 ? 'var(--accent-warn)' : 'var(--text-tertiary)',
                      width: '1.5rem',
                      flexShrink: 0,
                    }}>
                      #{r.rank}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{r.player_name}</span>
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
                    <div style={{ textAlign: 'right', minWidth: '3rem' }}>
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                        {r.sessions_played}s
                      </span>
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                        {r.times_dealer}d
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Season summary */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.625rem', paddingTop: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
              Start: {season.starting_balance} · Buy-in: {season.starting_balance / 2}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryAccordion({ seasons }: { seasons: Season[] }) {
  return (
    <>
      {seasons.map((s) => (
        <SeasonCard key={s.id} season={s} />
      ))}
    </>
  )
}
