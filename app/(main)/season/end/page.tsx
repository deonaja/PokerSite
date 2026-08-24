import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { Card } from '@/components/ui/card'
import SeasonEndConfirm from './SeasonEndConfirm'
import SeasonEndLeaderboard from './SeasonEndLeaderboard'

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
  avatar_color: string | null
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
      SELECT p.id, p.name, p.balance, p.avatar_color
      FROM players p
      JOIN season_players mp ON mp.player_id = p.id AND mp.season_id = ${seasonId}
      ORDER BY p.balance DESC, p.name ASC
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
    <div className="pb-24">
      <div className="border-b border-border px-4 py-3.5 text-center">
        <p className="mb-1 text-xs font-medium tracking-[0.08em] text-warn">
          MUSIM #{season.number} SELESAI
        </p>
        <p className="m-0 text-[0.8125rem] text-[var(--text-tertiary)]">
          {season.sessions_played} dari {season.max_sessions} sesi
          {season.preset_name ? ` · ${season.preset_name}` : ''}
        </p>
      </div>

      <SeasonEndLeaderboard
        players={players}
        startingBalance={season.starting_balance}
      />

      <div className="px-4">
        <Card className="mb-6 border-destructive px-4 py-3.5">
          <p className="m-0 mb-1 text-[0.8125rem] font-medium text-warn">
            Setelah konfirmasi:
          </p>
          <p className="m-0 text-[0.8125rem] leading-normal text-muted-foreground">
            Semua balance akan di-reset ke <span className="font-mono text-foreground">{season.starting_balance}</span>.
            Hasil musim ini akan di-snapshot. Musim baru siap dimulai.
          </p>
        </Card>
      </div>

      <SeasonEndConfirm seasonId={season.id} />
    </div>
  )
}
