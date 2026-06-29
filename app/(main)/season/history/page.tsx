import { sql } from '@/lib/db'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HistoryAccordion from './HistoryAccordion'

interface SeasonRow {
  id: string
  number: number
  preset_name: string | null
  starting_balance: number
  buy_in: number
  max_sessions: number
  sessions_played: number
  started_at: string
  ended_at: string | null
}

interface ResultRow {
  season_id: string
  player_id: string
  player_name: string
  final_balance: number
  rank: number
  sessions_played: number
  times_dealer: number
  total_won: number
  total_lost: number
}

async function getData() {
  const [seasonRows, resultRows] = await Promise.all([
    sql`
      SELECT
        se.id,
        se.number,
        se.preset_name,
        se.starting_balance,
        se.buy_in,
        se.max_sessions,
        COUNT(s.id) FILTER (WHERE s.status = 'ended')::int AS sessions_played,
        se.started_at,
        se.ended_at
      FROM seasons se
      LEFT JOIN sessions s ON s.season_id = se.id
      WHERE se.status = 'ended'
      GROUP BY se.id
      ORDER BY se.number DESC
    ` as unknown as Promise<SeasonRow[]>,
    sql`
      SELECT
        sr.season_id,
        sr.player_id,
        p.name AS player_name,
        sr.final_balance,
        sr.rank,
        sr.sessions_played,
        sr.times_dealer,
        sr.total_won,
        sr.total_lost
      FROM season_results sr
      JOIN players p ON p.id = sr.player_id
      ORDER BY sr.season_id, sr.rank ASC
    ` as unknown as Promise<ResultRow[]>,
  ])

  const seasons = await seasonRows
  const results = await resultRows

  const resultsBySeason = new Map<string, ResultRow[]>()
  for (const r of results) {
    if (!resultsBySeason.has(r.season_id)) resultsBySeason.set(r.season_id, [])
    resultsBySeason.get(r.season_id)!.push(r)
  }

  return seasons.map((s) => ({
    ...s,
    results: resultsBySeason.get(s.id) ?? [],
  }))
}

export default async function SeasonHistoryPage() {
  const seasons = await getData()

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-muted-foreground no-underline"
        >
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </Link>
        <span className="text-sm font-medium text-foreground">Riwayat Musim</span>
      </div>

      {seasons.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
          Belum ada musim yang selesai.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 p-4">
          <HistoryAccordion seasons={seasons} />
        </div>
      )}
    </div>
  )
}
