import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SessionEndWizard from '@/components/SessionEndWizard'

interface ParticipantRow {
  session_id: string
  player_id: string
  player_name: string
  is_dealer: boolean
  rebuy_count: number
  current_balance: number
}

async function getSessionData() {
  const rows = (await sql`
    SELECT
      s.id          AS session_id,
      sp.player_id,
      sp.is_dealer,
      sp.rebuy_count,
      p.name        AS player_name,
      p.balance     AS current_balance
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
      player_id: r.player_id,
      player_name: r.player_name,
      is_dealer: r.is_dealer,
      rebuy_count: r.rebuy_count,
      current_balance: r.current_balance,
    })),
  }
}

export default async function SessionEndPage() {
  const data = await getSessionData()
  if (!data) redirect('/')

  return <SessionEndWizard sessionId={data.sessionId} participants={data.participants} />
}
