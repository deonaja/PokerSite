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

  const seasonRows = await sql`
    SELECT se.buy_in, se.current_phase, se.rake_rate
    FROM seasons se
    JOIN sessions s ON s.season_id = se.id
    WHERE s.status = 'active'
    LIMIT 1
  `
  const seasonRow = seasonRows[0] as { buy_in: number; current_phase: string; rake_rate: number } | undefined
  const buyIn = seasonRow?.buy_in ?? 100
  const isPhase2 = seasonRow?.current_phase === 'steady'
  const rakeRate = seasonRow?.rake_rate ?? 0

  return {
    sessionId: rows[0].session_id,
    buyIn,
    isPhase2,
    rakeRate,
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

  return (
    <SessionEndWizard
      sessionId={data.sessionId}
      participants={data.participants}
      buyIn={data.buyIn}
      isPhase2={data.isPhase2}
      rakeRate={data.rakeRate}
    />
  )
}
