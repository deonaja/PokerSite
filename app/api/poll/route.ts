import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import type { Player, PollParticipant, PollResponse } from '@/lib/types'

export async function GET() {
  const [players, sessions] = await Promise.all([
    sql`SELECT id, name, balance, created_at FROM players ORDER BY name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
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
      ORDER BY sp.is_dealer DESC, p.name ASC
    `
    activeSession = {
      id: activeSessionRow.id,
      participants: participants as unknown as PollParticipant[],
    }
  }

  const body: PollResponse = {
    players: players as unknown as Player[],
    activeSession,
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
