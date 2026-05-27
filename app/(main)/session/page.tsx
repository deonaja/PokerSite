import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SessionView from '@/components/SessionView'
import type { Player, PollParticipant, PollResponse } from '@/lib/types'

async function getSessionInitial(): Promise<{ sessionId: string; buyIn: number; initial: PollResponse } | null> {
  const [sessions, players] = await Promise.all([
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
    sql`SELECT id, name, balance, created_at FROM players ORDER BY name ASC`,
  ])

  const sessionRow = (sessions as unknown as { id: string }[])[0]
  if (!sessionRow) return null

  const [participants, seasonRows] = await Promise.all([
    sql`
      SELECT sp.id AS participant_id, sp.player_id, p.name AS player_name,
             sp.is_dealer, sp.no_gaji_dealer, sp.rebuy_count, sp.final_stack
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
  const data = await getSessionInitial()
  if (!data) redirect('/')

  return <SessionView sessionId={data.sessionId} initial={data.initial} buyIn={data.buyIn} />
}
