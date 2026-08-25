// Tur Tamu stop 2-3: the real dashboard, live data, unauthenticated. Reuses
// the exact same query the authenticated dashboard and /api/poll run — this
// is public, non-per-user data already served to anonymous callers (see
// app/api/poll/route.ts), so there is no new exposure here. currentPlayerId
// is null: DashboardClient already renders correctly for that (no "kamu"
// badge, Profil tab falls back to /identity).
export const dynamic = 'force-dynamic'

import { sql } from '@/lib/db'
import type { Player, Season, PollParticipant, PollResponse } from '@/lib/types'
import DashboardClient from '@/components/DashboardClient'
import TourHeader from '@/components/tour/TourHeader'
import TourOverlay from '@/components/TourOverlay'

async function getDashboardData(): Promise<{ initial: PollResponse; season: Season | null; sessionsPlayed: number }> {
  const [players, sessions, seasonRows, playedRows] = await Promise.all([
    sql`SELECT p.id, p.name, p.balance, p.created_at
        FROM players p
        JOIN season_players mp ON mp.player_id = p.id
        JOIN seasons s ON s.id = mp.season_id AND s.status = 'active'
        ORDER BY p.name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' AND mode = 'offline' LIMIT 1`,
    sql`SELECT id, number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase, creator_player_id, started_at, ended_at, p1_target_sessions, p2_target_sessions, p1_sessions_actual FROM seasons WHERE status = 'active' LIMIT 1`,
    sql`SELECT COUNT(*)::int AS played FROM sessions s JOIN seasons se ON se.id = s.season_id WHERE se.status = 'active' AND s.status = 'ended'`,
  ])

  const activeSessionRow = (sessions as unknown as { id: string }[])[0]
  let activeSession: PollResponse['activeSession'] = null

  if (activeSessionRow) {
    const participants = await sql`
      SELECT sp.id AS participant_id, sp.player_id, p.name AS player_name,
             sp.is_dealer, sp.rebuy_count, sp.final_stack
      FROM session_participants sp
      JOIN players p ON p.id = sp.player_id
      WHERE sp.session_id = ${activeSessionRow.id}
      ORDER BY p.name ASC
    `
    activeSession = {
      id: activeSessionRow.id,
      participants: participants as unknown as PollParticipant[],
    }
  }

  return {
    initial: {
      players: players as unknown as Player[],
      activeSession,
    },
    season: (seasonRows[0] as unknown as Season) ?? null,
    sessionsPlayed: (playedRows[0] as unknown as { played: number } | undefined)?.played ?? 0,
  }
}

export default async function TourDashboardPage() {
  const { initial, season, sessionsPlayed } = await getDashboardData()

  return (
    <div className="flex min-h-dvh flex-col">
      <TourHeader />
      <main className="flex-1">
        <DashboardClient initial={initial} season={season} sessionsPlayed={sessionsPlayed} currentPlayerId={null} />
      </main>
      <TourOverlay />
    </div>
  )
}
