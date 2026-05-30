import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'
import type { Player, Season, PollParticipant, PollResponse } from '@/lib/types'
import DashboardClient from '@/components/DashboardClient'

async function getDashboardData(): Promise<{ initial: PollResponse; season: Season | null }> {
  const [players, sessions, seasonRows] = await Promise.all([
    sql`SELECT id, name, balance, created_at FROM players ORDER BY name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
    sql`SELECT id, number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase, creator_player_id, started_at, ended_at FROM seasons WHERE status = 'active' LIMIT 1`,
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
  }
}

export default async function DashboardPage() {
  const [{ initial, season }, authPlayer] = await Promise.all([
    getDashboardData(),
    getAuthenticatedPlayer(),
  ])
  return <DashboardClient initial={initial} season={season} currentPlayerId={authPlayer?.id ?? null} />
}
