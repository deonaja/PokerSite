import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import BalanceDisplay from '@/components/BalanceDisplay'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { formatDurationShort } from '@/lib/duration'
import { Trophy, Medal, Award, Crown, Coins, TrendingUp, ArrowLeft, type LucideIcon } from 'lucide-react'

// Achievement icons keyed by key (kept out of the logic module).
const ACH_ICONS: Record<string, LucideIcon> = {
  juara: Trophy,
  podium: Medal,
  veteran: Award,
  raja_bandar: Crown,
  sultan: Coins,
  musim_untung: TrendingUp,
}

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
  const [playerRows, resultRows, achRows, playtimeRows, sessionDeltaRows] = await Promise.all([
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
    sql`SELECT achievement_key FROM player_achievements WHERE player_id = ${id}` as unknown as Promise<{ achievement_key: string }[]>,
    // Total / count of finished sessions this player took part in, for play-time stats.
    sql`
      SELECT
        COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))), 0)::int AS total_seconds,
        COUNT(*)::int AS session_count
      FROM sessions s
      JOIN session_participants sp ON sp.session_id = s.id
      WHERE sp.player_id = ${id} AND s.status = 'ended' AND s.ended_at IS NOT NULL
    ` as unknown as Promise<{ total_seconds: number; session_count: number }[]>,
    // Per-session net delta for this player across all ended sessions, oldest first.
    // Delta is derived from edit_log: SUM(balance_after - balance_before) over every
    // log entry for that (session_id, player_id). That naturally captures buy_in (−),
    // rebuy (−), rebuy_undo (+), dealer_salary_balance (+), session_end (+final_stack),
    // and dealer_salary_chips (0; chips appear inside final_stack).
    sql`
      SELECT
        s.id AS session_id,
        s.season_id,
        s.ended_at,
        COALESCE(SUM(el.balance_after - el.balance_before), 0)::int AS delta
      FROM sessions s
      JOIN session_participants sp ON sp.session_id = s.id AND sp.player_id = ${id}
      LEFT JOIN edit_log el ON el.session_id = s.id AND el.player_id = ${id}
        AND el.balance_before IS NOT NULL AND el.balance_after IS NOT NULL
      WHERE s.status = 'ended' AND s.ended_at IS NOT NULL
      GROUP BY s.id, s.season_id, s.ended_at
      ORDER BY s.ended_at ASC
    ` as unknown as Promise<{ session_id: string; season_id: string | null; ended_at: string; delta: number }[]>,
  ])

  const player = playerRows[0] ?? null
  const earnedKeys = new Set(achRows.map((a) => a.achievement_key))
  const pt = playtimeRows[0] ?? { total_seconds: 0, session_count: 0 }
  return {
    player,
    results: resultRows,
    earnedKeys,
    totalPlaySeconds: Number(pt.total_seconds),
    playedSessionCount: Number(pt.session_count),
    sessionDeltas: sessionDeltaRows,
  }
}

/**
 * Win-streak math: a "win" is a session where the player's net delta > 0.
 * Ties (delta = 0) and losses both break the streak — conservative on owner's call.
 *
 * - currentStreak: count consecutive wins from the LATEST session backwards.
 *   Resets to 0 the moment we hit a non-win.
 * - longestStreak: max consecutive wins anywhere in the player's history.
 */
function computeStreaks(deltas: number[]): { current: number; longest: number } {
  let current = 0
  for (let i = deltas.length - 1; i >= 0; i--) {
    if (deltas[i] > 0) current++
    else break
  }
  let longest = 0
  let run = 0
  for (const d of deltas) {
    if (d > 0) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  return { current, longest }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initialOf(name: string) {
  return (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { player, results, earnedKeys, totalPlaySeconds, playedSessionCount, sessionDeltas } = await getData(id)
  if (!player) notFound()

  const totalSeasons = results.length
  const bestRank = totalSeasons > 0 ? Math.min(...results.map((r) => r.rank)) : null
  const totalSessions = results.reduce((s, r) => s + r.sessions_played, 0)
  const totalTimesDealer = results.reduce((s, r) => s + r.times_dealer, 0)
  const totalWon = results.reduce((s, r) => s + r.total_won, 0)
  const totalLost = results.reduce((s, r) => s + r.total_lost, 0)
  const avgPlaySeconds = playedSessionCount > 0 ? Math.round(totalPlaySeconds / playedSessionCount) : 0
  const streaks = computeStreaks(sessionDeltas.map((d) => d.delta))

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-muted-foreground no-underline"
        >
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </Link>
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xl font-medium text-foreground"
        >
          {initialOf(player.name)}
        </span>
        <div className="flex-1">
          <p className="text-[0.9375rem] font-medium text-foreground">{player.name}</p>
        </div>
        <BalanceDisplay balance={player.balance} />
      </div>

      <div className="px-4 pt-5">
        {/* Overall stats */}
        {(totalSeasons > 0 || playedSessionCount > 0) && (
          <>
            <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
              STATISTIK KESELURUHAN
            </p>
            <div className="mb-6 grid grid-cols-2 gap-2">
              {totalSeasons > 0 && (
                <>
                  <StatBox label="Musim dimainkan" value={totalSeasons} />
                  <StatBox label="Rank terbaik" value={bestRank !== null ? `#${bestRank}` : '—'} />
                  <StatBox label="Total sesi" value={totalSessions} />
                  <StatBox label="Jadi dealer" value={totalTimesDealer} />
                  <StatBox label="Total menang" value={totalWon} mono positive />
                  <StatBox label="Total kalah" value={totalLost} mono negative />
                </>
              )}
              {playedSessionCount > 0 && (
                <>
                  <StatBox label="Total waktu main" value={formatDurationShort(totalPlaySeconds)} />
                  <StatBox label="Rata-rata/sesi" value={formatDurationShort(avgPlaySeconds)} />
                  <StatBox
                    label="Streak menang"
                    value={streaks.current > 0 ? `${streaks.current} sesi` : '—'}
                    mono
                  />
                  <StatBox
                    label="Streak terpanjang"
                    value={streaks.longest > 0 ? `${streaks.longest} sesi` : '—'}
                    mono
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* Achievements */}
        <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">PENCAPAIAN</p>
        <div className="mb-6 grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const earned = earnedKeys.has(a.key)
            const Icon = ACH_ICONS[a.key] ?? Award
            return (
              <div
                key={a.key}
                className={
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ' +
                  (earned ? 'border-primary bg-accent' : 'border-border bg-card opacity-60')
                }
              >
                <Icon
                  aria-hidden
                  className={'h-5 w-5 shrink-0 ' + (earned ? 'text-warn' : 'text-[var(--text-tertiary)]')}
                />
                <div className="min-w-0">
                  <p className={'truncate text-xs font-medium ' + (earned ? 'text-foreground' : 'text-muted-foreground')}>
                    {a.label}
                  </p>
                  <p className="text-[0.625rem] leading-tight text-[var(--text-tertiary)]">{a.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Per-season breakdown */}
        <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
          PER MUSIM
        </p>

        {results.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Belum ada musim selesai.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const delta = r.final_balance - r.starting_balance
              return (
                <Card
                  key={r.season_id}
                  className={`px-4 py-3.5 ${r.rank === 1 ? 'border-warn' : 'border-border'}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Musim #{r.season_number}
                    </span>
                    {r.preset_name && (
                      <span className="text-[0.6875rem] capitalize text-[var(--text-tertiary)]">{r.preset_name}</span>
                    )}
                    <Badge
                      variant={r.rank === 1 ? 'warn' : 'secondary'}
                      className="ml-auto font-mono normal-case tracking-normal"
                    >
                      #{r.rank}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {r.sessions_played} sesi · {r.times_dealer}× dealer
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-sm text-foreground">
                        {r.final_balance}
                      </span>
                      <span
                        className={`block font-mono text-[0.6875rem] ${delta >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                  </div>

                  {r.ended_at && (
                    <p className="mt-1.5 text-[0.6875rem] text-[var(--text-tertiary)]">
                      {formatDate(r.ended_at)}
                    </p>
                  )}
                </Card>
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
  const color = positive ? 'text-success' : negative ? 'text-destructive' : 'text-foreground'
  return (
    <Card className="p-3">
      <p className="mb-1 text-[0.6875rem] tracking-[0.02em] text-[var(--text-tertiary)]">{label}</p>
      <p className={`text-lg font-medium ${color} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </Card>
  )
}
