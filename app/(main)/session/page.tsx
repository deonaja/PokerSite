import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'
import SessionView from '@/components/SessionView'
import type { Player, PollParticipant, PollResponse } from '@/lib/types'

async function getSessionInitial(): Promise<{ sessionId: string; buyIn: number; startedAt: string; creatorPlayerId: string | null; initial: PollResponse } | null> {
  const [sessions, players] = await Promise.all([
    sql`SELECT id, started_at, creator_player_id FROM sessions WHERE status = 'active' AND mode = 'offline' LIMIT 1`,
    // Scope to the active season's MEMBERS (season_players), not every player row.
    sql`SELECT p.id, p.name, p.balance, p.created_at
        FROM players p
        JOIN season_players mp ON mp.player_id = p.id
        JOIN seasons s ON s.id = mp.season_id AND s.status = 'active'
        ORDER BY p.name ASC`,
  ])

  const sessionRow = (sessions as unknown as { id: string; started_at: string; creator_player_id: string | null }[])[0]
  if (!sessionRow) return null

  const [participants, seasonRows] = await Promise.all([
    sql`
      SELECT sp.id AS participant_id, sp.player_id, p.name AS player_name,
             sp.is_dealer, sp.no_gaji_dealer, sp.rebuy_count, sp.final_stack,
             p.balance
      FROM session_participants sp
      JOIN players p ON p.id = sp.player_id
      WHERE sp.session_id = ${sessionRow.id}
      ORDER BY sp.is_dealer DESC, sp.no_gaji_dealer ASC, p.name ASC
    `,
    sql`
      SELECT se.buy_in
      FROM seasons se
      JOIN sessions s ON s.season_id = se.id
      WHERE s.id = ${sessionRow.id}
      LIMIT 1
    `,
  ])

  const buyIn = (seasonRows[0] as { buy_in: number } | undefined)?.buy_in ?? 100

  return {
    sessionId: sessionRow.id,
    buyIn,
    startedAt: sessionRow.started_at,
    creatorPlayerId: sessionRow.creator_player_id,
    initial: {
      players: players as unknown as Player[],
      activeSession: {
        id: sessionRow.id,
        participants: participants as unknown as PollParticipant[],
      },
    },
  }
}

export default async function SessionPage() {
  const [data, authPlayer] = await Promise.all([getSessionInitial(), getAuthenticatedPlayer()])
  if (!data) redirect('/')

  return (
    <SessionView
      sessionId={data.sessionId}
      initial={data.initial}
      buyIn={data.buyIn}
      startedAt={data.startedAt}
      currentPlayerId={authPlayer?.id ?? null}
      creatorPlayerId={data.creatorPlayerId}
    />
  )
}
