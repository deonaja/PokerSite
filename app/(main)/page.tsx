import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'
import type { Player, Season, PollParticipant, PollResponse } from '@/lib/types'
import DashboardClient from '@/components/DashboardClient'

async function getDashboardData(): Promise<{ initial: PollResponse; season: Season | null; sessionsPlayed: number }> {
  const [players, sessions, seasonRows, playedRows] = await Promise.all([
    // Scope to the active season's MEMBERS (season_players), not every player row.
    sql`SELECT p.id, p.name, p.balance, p.created_at
        FROM players p
        JOIN season_players mp ON mp.player_id = p.id
        JOIN seasons s ON s.id = mp.season_id AND s.status = 'active'
        ORDER BY p.name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' AND mode = 'offline' LIMIT 1`,
    sql`SELECT id, number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, current_phase, creator_player_id, started_at, ended_at, p1_target_sessions, p2_target_sessions, p1_sessions_actual FROM seasons WHERE status = 'active' LIMIT 1`,
    // Ended sessions in the active season — drives the Phase 2 → end-game progress.
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

export default async function DashboardPage() {
  const [{ initial, season, sessionsPlayed }, authPlayer] = await Promise.all([
    getDashboardData(),
    getAuthenticatedPlayer(),
  ])
  // Bug fix: if the season's session cap has been hit AND it's still active
  // (= user bailed out of /season/end without confirming), force them back to
  // finalize. Without this, the dashboard happily shows a "start new session"
  // CTA — but startSession is now server-side-gated too, so it'd just error.
  // Redirect makes the state visible instead of silently broken.
  if (season && season.status === 'active' && sessionsPlayed >= season.max_sessions) {
    redirect(`/season/end?id=${season.id}`)
  }
  return (
    <DashboardClient
      initial={initial}
      season={season}
      sessionsPlayed={sessionsPlayed}
      currentPlayerId={authPlayer?.id ?? null}
    />
  )
}
