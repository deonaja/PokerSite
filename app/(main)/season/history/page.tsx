import { sql } from '@/lib/db'
import Link from 'next/link'
import HistoryAccordion from './HistoryAccordion'

interface SeasonRow {
  id: string
  number: number
  preset_name: string | null
  starting_balance: number
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
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link
          href="/"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.125rem', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          ←
        </Link>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Riwayat Musim</span>
      </div>

      {seasons.length === 0 ? (
        <p style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Belum ada musim yang selesai.
        </p>
      ) : (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <HistoryAccordion seasons={seasons} />
        </div>
      )}
    </div>
  )
}
