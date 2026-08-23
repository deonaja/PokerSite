import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import PerformanceChartLazy from '@/components/PerformanceChartLazy'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACHIEVEMENTS, computeLifetimeCounts } from '@/lib/achievements'
import { AchievementIcon, type AchievementCategoryId } from '@/components/AchievementIcon'
import { formatDurationShort } from '@/lib/duration'
import { ArrowLeft } from 'lucide-react'

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
  const [
    playerRows,
    resultRows,
    achRows,
    playtimeRows,
    sessionDeltaRows,
    chartRows,
    playerSeasonsRows,
    playerSeasonSessionRows,
  ] = await Promise.all([
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
    sql`SELECT achievement_key, tier FROM player_achievements WHERE player_id = ${id}` as unknown as Promise<{ achievement_key: string; tier: number }[]>,
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
    // Per-session post-cash-out balance for the PerformanceChart. session_end's
    // balance_after captures exactly the player's balance the moment they walked
    // away from that session (= prior balance + final_stack). Oldest first.
    sql`
      SELECT s.season_id, el.balance_after AS balance, s.ended_at
      FROM edit_log el
      JOIN sessions s ON s.id = el.session_id
      WHERE el.player_id = ${id}
        AND el.action = 'session_end'
        AND s.status = 'ended'
        AND s.ended_at IS NOT NULL
      ORDER BY s.ended_at ASC, el.created_at ASC
    ` as unknown as Promise<{ season_id: string | null; balance: number; ended_at: string }[]>,
    // All seasons this player has been part of (active membership OR historical
    // result). Sorted oldest first so the chart picker lists them naturally.
    sql`
      SELECT se.id, se.number, se.status, se.starting_balance
      FROM seasons se
      WHERE se.id IN (
        SELECT season_id FROM season_players WHERE player_id = ${id}
        UNION
        SELECT season_id FROM season_results WHERE player_id = ${id}
      )
      ORDER BY se.number ASC
    ` as unknown as Promise<{ id: string; number: number; status: string; starting_balance: number }[]>,
    // All ENDED sessions in any of those seasons, with the player's session_end
    // balance_after when they participated (null when they skipped). Carry-
    // forward is computed in JS to render a stagnant line for skipped sessions.
    sql`
      SELECT
        s.season_id,
        s.id AS session_id,
        s.ended_at,
        (
          SELECT el.balance_after FROM edit_log el
          WHERE el.session_id = s.id
            AND el.player_id = ${id}
            AND el.action = 'session_end'
          LIMIT 1
        ) AS balance_after
      FROM sessions s
      WHERE s.status = 'ended'
        AND s.ended_at IS NOT NULL
        AND s.season_id IN (
          SELECT season_id FROM season_players WHERE player_id = ${id}
          UNION
          SELECT season_id FROM season_results WHERE player_id = ${id}
        )
      ORDER BY s.season_id, s.ended_at ASC
    ` as unknown as Promise<{ season_id: string; session_id: string; ended_at: string; balance_after: number | null }[]>,
  ])

  const player = playerRows[0] ?? null
  // Map of categoryId -> Set<tier> earned, used by the UI to color icons.
  const earnedByCategory = new Map<string, Set<number>>()
  for (const a of achRows) {
    const set = earnedByCategory.get(a.achievement_key) ?? new Set<number>()
    set.add(a.tier)
    earnedByCategory.set(a.achievement_key, set)
  }
  const pt = playtimeRows[0] ?? { total_seconds: 0, session_count: 0 }

  // Group sessions by season for fast lookup
  const sessionsBySeason = new Map<string, typeof playerSeasonSessionRows>()
  for (const row of playerSeasonSessionRows) {
    const arr = sessionsBySeason.get(row.season_id) ?? []
    arr.push(row)
    sessionsBySeason.set(row.season_id, arr)
  }

  // Build one chart series per season the player has joined. Each series starts
  // at session 0 with the season's starting_balance (pre-first-session), then
  // adds ONE POINT PER ENDED SESSION IN THE SEASON whether the player took part
  // or not. Sessions skipped → carry forward the previous balance (stagnant
  // line). Owner: "kalau ga ikut sesi 3 maka grafik 2 ke 3 itu stagnan".
  const seasonsChartData = playerSeasonsRows.map((season) => {
    const startingBalance = Number(season.starting_balance)
    const data: { session: number; balance: number }[] = []
    let runningBalance = startingBalance
    data.push({ session: 0, balance: runningBalance })
    const sessions = sessionsBySeason.get(season.id) ?? []
    for (const s of sessions) {
      if (s.balance_after !== null) {
        runningBalance = Number(s.balance_after)
      }
      data.push({ session: data.length, balance: runningBalance })
    }
    return {
      seasonId: season.id,
      seasonNumber: season.number,
      isActive: season.status === 'active',
      data,
    }
  })

  return {
    player,
    results: resultRows,
    earnedByCategory,
    totalPlaySeconds: Number(pt.total_seconds),
    playedSessionCount: Number(pt.session_count),
    sessionDeltas: sessionDeltaRows,
    seasonsChartData,
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
  const {
    player,
    results,
    earnedByCategory,
    totalPlaySeconds,
    playedSessionCount,
    sessionDeltas,
    seasonsChartData,
  } = await getData(id)
  if (!player) notFound()

  const totalSeasons = results.length
  const bestRank = totalSeasons > 0 ? Math.min(...results.map((r) => r.rank)) : null
  const totalSessions = results.reduce((s, r) => s + r.sessions_played, 0)
  const totalTimesDealer = results.reduce((s, r) => s + r.times_dealer, 0)
  const totalWon = results.reduce((s, r) => s + r.total_won, 0)
  const totalLost = results.reduce((s, r) => s + r.total_lost, 0)

  // Lifetime counts driving the progressive achievement rows. dealer_count is
  // overridden with totalTimesDealer (sum of season_results.times_dealer for
  // this player) which matches what session_participants would give for ended
  // seasons.
  const lifetimeCounts = computeLifetimeCounts(
    results.map((r) => ({
      rank: r.rank,
      final_balance: r.final_balance,
      sessions_played: r.sessions_played,
      times_dealer: r.times_dealer,
      total_won: r.total_won,
      total_lost: r.total_lost,
      starting_balance: r.starting_balance,
    })),
    totalTimesDealer,
  )
  const avgPlaySeconds = playedSessionCount > 0 ? Math.round(totalPlaySeconds / playedSessionCount) : 0
  const streaks = computeStreaks(sessionDeltas.map((d) => d.delta))

  return (
    <div className="pb-8">
      {/* Header — teletext status bar */}
      <div className="flex items-center gap-3 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-3">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-[var(--tt-cyan)] no-underline"
        >
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </Link>
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--tt-cyan)] bg-[var(--tt-cyan-dim)] text-xl uppercase text-[var(--tt-cyan)]"
        >
          {initialOf(player.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl uppercase tracking-wide text-[var(--tt-white)]">{player.name}</p>
          <p className="text-sm uppercase tracking-wide text-[var(--text-tertiary)]"><span className="text-[var(--tt-magenta)]">P500</span> Pemain</p>
        </div>
        <span className={'text-2xl tabular-nums ' + (player.balance < 0 ? 'text-[var(--tt-red)]' : 'text-[var(--tt-cyan)]')}>
          {player.balance}
        </span>
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

        {/* Performance chart — balance over time, per season (picker). */}
        {seasonsChartData.length > 0 && (
          <>
            <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
              PERFORMA
            </p>
            <div className="mb-6">
              <PerformanceChartLazy seasons={seasonsChartData} />
            </div>
          </>
        )}

        {/* Progressive achievements — each row is one category with 3 tier icons. */}
        <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">PENCAPAIAN</p>
        <div className="mb-6 flex flex-col gap-3">
          {ACHIEVEMENTS.map((cat) => {
            const earnedTiers = earnedByCategory.get(cat.id) ?? new Set<number>()
            const count = lifetimeCounts[cat.metric]
            // Highest tier earned drives the "MAX" / "x/y" progress line.
            const maxTier = Math.max(0, ...Array.from(earnedTiers))
            const nextTier = cat.tiers.find((t) => t.tier > maxTier) ?? null
            const allEarned = maxTier === 3
            return (
              <div key={cat.id} className="rounded-lg border border-border bg-card px-3 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {cat.tiers.map((t) => {
                    const earned = earnedTiers.has(t.tier)
                    return (
                      <div
                        key={t.tier}
                        className="flex flex-col items-center gap-1.5"
                        title={`${t.name} — ${t.description}`}
                      >
                        <AchievementIcon
                          categoryId={cat.id as AchievementCategoryId}
                          tier={earned ? (t.tier as 1 | 2 | 3) : 0}
                          size={48}
                        />
                        <p className={
                          'text-center text-[0.6875rem] leading-tight ' +
                          (earned ? 'text-foreground' : 'text-[var(--text-tertiary)]')
                        }>
                          {t.name}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-center font-mono text-[0.6875rem] tabular-nums text-[var(--text-tertiary)]">
                  {allEarned ? 'MAX' : nextTier ? `${count} / ${nextTier.threshold}` : `${count}`}
                </p>
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
