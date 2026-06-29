'use client'

import { useState } from 'react'
import { Trophy, ChevronUp, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'

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
  buy_in: number
  max_sessions: number
  sessions_played: number
  started_at: string
  ended_at: string | null
  results: SeasonResult[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

function SeasonCard({ season }: { season: Season }) {
  const [open, setOpen] = useState(false)
  const winner = season.results[0]

  return (
    <Card className="overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-[0.9375rem] font-medium text-foreground">
              Musim #{season.number}
            </span>
            {season.preset_name && (
              <span className="text-[0.6875rem] capitalize text-[var(--text-tertiary)]">
                {season.preset_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <span>
              {season.sessions_played} sesi
              {season.ended_at ? ` · ${formatDate(season.ended_at)}` : ''}
            </span>
            {winner && (
              <span className="inline-flex items-center gap-1">
                ·<Trophy aria-hidden className="h-3 w-3" />
                {winner.player_name}
              </span>
            )}
          </div>
        </div>
        <span className="flex-shrink-0 text-[var(--text-tertiary)]">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expandable leaderboard */}
      {open && (
        <div className="border-t border-border px-4 py-3">
          {season.results.length === 0 ? (
            <p className="m-0 text-[0.8125rem] text-[var(--text-tertiary)]">Tidak ada data hasil.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {season.results.map((r) => {
                const delta = r.final_balance - season.starting_balance
                return (
                  <div
                    key={r.player_id}
                    className="flex items-center gap-2.5 border-b border-border py-2"
                  >
                    <span
                      className={
                        'w-6 flex-shrink-0 font-mono text-xs ' +
                        (r.rank === 1 ? 'text-warn' : 'text-[var(--text-tertiary)]')
                      }
                    >
                      #{r.rank}
                    </span>
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground"
                    >
                      {initialOf(r.player_name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.player_name}</span>
                    <div className="text-right">
                      <span className="block font-mono text-sm text-foreground">
                        {r.final_balance}
                      </span>
                      <span
                        className={
                          'block font-mono text-[0.6875rem] ' +
                          (delta >= 0 ? 'text-success' : 'text-destructive')
                        }
                      >
                        {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                    <div className="min-w-12 text-right">
                      <span className="block text-[0.6875rem] text-[var(--text-tertiary)]">
                        {r.sessions_played}s
                      </span>
                      <span className="block text-[0.6875rem] text-[var(--text-tertiary)]">
                        {r.times_dealer}d
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Season summary */}
          <div className="mt-2.5 flex gap-4 pt-1.5">
            <span className="text-[0.6875rem] text-[var(--text-tertiary)]">
              Start: {season.starting_balance} · Buy-in: {season.buy_in}
            </span>
          </div>
        </div>
      )}
    </Card>
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
