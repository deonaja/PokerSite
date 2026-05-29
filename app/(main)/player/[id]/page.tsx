import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import BalanceDisplay from '@/components/BalanceDisplay'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-lg text-muted-foreground no-underline"
        >
          ←
        </Link>
        <div className="flex-1">
          <p className="text-[0.9375rem] font-medium text-foreground">{player.name}</p>
        </div>
        <BalanceDisplay balance={player.balance} />
      </div>

      <div className="px-4 pt-5">
        {/* Overall stats */}
        {totalSeasons > 0 && (
          <>
            <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
              STATISTIK KESELURUHAN
            </p>
            <div className="mb-6 grid grid-cols-2 gap-2">
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
