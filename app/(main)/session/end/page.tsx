import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import SessionEndWizard from '@/components/SessionEndWizard'

interface ParticipantRow {
  session_id: string
  player_id: string
  player_name: string
  is_dealer: boolean
  no_gaji_dealer: boolean
  rebuy_count: number
  current_balance: number
  contributed: number
}

async function getSessionData() {
  // Per-participant `contributed` = chips actually put into the table
  // (buy-in + rebuys − undos), summed from the edit_log. Handles free dealers,
  // deals-only dealers, and partial low-balance buy-ins automatically.
  const rows = (await sql`
    SELECT
      s.id          AS session_id,
      sp.player_id,
      sp.is_dealer,
      sp.no_gaji_dealer,
      sp.rebuy_count,
      p.name        AS player_name,
      p.balance     AS current_balance,
      COALESCE((
        SELECT SUM(el.balance_before - el.balance_after)
        FROM edit_log el
        WHERE el.session_id = s.id
          AND el.player_id = sp.player_id
          AND el.action IN ('buy_in', 'buy_in_dealer_phase2', 'buy_in_dealer_free', 'rebuy', 'rebuy_undo')
      ), 0)::int AS contributed
    FROM sessions s
    JOIN session_participants sp ON sp.session_id = s.id
    JOIN players p ON p.id = sp.player_id
    WHERE s.status = 'active'
    ORDER BY sp.is_dealer DESC, p.name ASC
  `) as ParticipantRow[]

  if (rows.length === 0) return null

  const expectedTotal = rows.reduce((sum, r) => sum + Number(r.contributed), 0)

  return {
    sessionId: rows[0].session_id,
    expectedTotal,
    participants: rows.map((r) => ({
      player_id: r.player_id,
      player_name: r.player_name,
      is_dealer: r.is_dealer,
      no_gaji_dealer: r.no_gaji_dealer,
      rebuy_count: r.rebuy_count,
      current_balance: r.current_balance,
      contributed: Number(r.contributed),
    })),
  }
}

export default async function SessionEndPage() {
  const data = await getSessionData()
  if (!data) redirect('/')

  return (
    <SessionEndWizard
      sessionId={data.sessionId}
      participants={data.participants}
      expectedTotal={data.expectedTotal}
    />
  )
}
