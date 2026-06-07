import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import type { Player, PollParticipant, PollResponse } from '@/lib/types'

export async function GET() {
  const [players, sessions] = await Promise.all([
    // Scope to the active season's MEMBERS (season_players), not every player row.
    sql`SELECT p.id, p.name, p.balance, p.created_at
        FROM players p
        JOIN season_players mp ON mp.player_id = p.id
        JOIN seasons s ON s.id = mp.season_id AND s.status = 'active'
        ORDER BY p.name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
  ])

  const activeSessionRow = (sessions as unknown as { id: string }[])[0]
  let activeSession: PollResponse['activeSession'] = null

  if (activeSessionRow) {
    const participants = await sql`
      SELECT sp.id AS participant_id, sp.player_id, p.name AS player_name,
             sp.is_dealer, sp.no_gaji_dealer, sp.rebuy_count, sp.final_stack,
             p.balance
      FROM session_participants sp
      JOIN players p ON p.id = sp.player_id
      WHERE sp.session_id = ${activeSessionRow.id}
      ORDER BY sp.is_dealer DESC, sp.no_gaji_dealer ASC, p.name ASC
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
    headers: {
      // Short shared-CDN cache: bursts / abuse get served from Vercel's edge
      // instead of re-invoking the function + hammering Neon. The payload is
      // global (no per-user data), so a shared cache is correct. Each client
      // still revalidates on its 2s poll; worst-case staleness ≈ 1s.
      // stale-while-revalidate smooths spikes — at most one origin hit per window.
      'Cache-Control': 'public, max-age=0, s-maxage=1, stale-while-revalidate=4',
    },
  })
}
