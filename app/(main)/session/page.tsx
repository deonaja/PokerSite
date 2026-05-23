import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SessionView from '@/components/SessionView'

interface ParticipantRow {
  session_id: string
  participant_id: string
  player_id: string
  player_name: string
  is_dealer: boolean
  rebuy_count: number
  final_stack: number | null
}

async function getActiveSession() {
  const rows = (await sql`
    SELECT
      s.id          AS session_id,
      sp.id         AS participant_id,
      sp.player_id,
      sp.is_dealer,
      sp.rebuy_count,
      sp.final_stack,
      p.name        AS player_name
    FROM sessions s
    JOIN session_participants sp ON sp.session_id = s.id
    JOIN players p ON p.id = sp.player_id
    WHERE s.status = 'active'
    ORDER BY sp.is_dealer DESC, p.name ASC
  `) as ParticipantRow[]

  if (rows.length === 0) return null

  return {
    sessionId: rows[0].session_id,
    participants: rows.map((r) => ({
      participant_id: r.participant_id,
      player_id: r.player_id,
      player_name: r.player_name,
      is_dealer: r.is_dealer,
      rebuy_count: r.rebuy_count,
      final_stack: r.final_stack,
    })),
  }
}

export default async function SessionPage() {
  const session = await getActiveSession()
  if (!session) redirect('/')

  return <SessionView sessionId={session.sessionId} participants={session.participants} />
}
