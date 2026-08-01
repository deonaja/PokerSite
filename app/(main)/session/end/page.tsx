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
  original_balance: number
  started_at: string
}

interface SeasonRow {
  current_phase: string | null
  rake_rate: number | null
}

async function getSessionData() {
  // Per-participant accounting:
  //   contributed       = chips this player put on the table this session
  //                       (buy-in + rebuys − undos + dealer salary chips if Phase 1 dealer)
  //   original_balance  = the balance they had BEFORE the session touched them,
  //                       read from the balance_before of their first edit_log entry.
  const [rows, seasonRows] = await Promise.all([
    sql`
      SELECT
        s.id          AS session_id,
        s.started_at,
        sp.player_id,
        sp.is_dealer,
        sp.no_gaji_dealer,
        sp.rebuy_count,
        p.name        AS player_name,
        p.balance     AS current_balance,
        (
          COALESCE((
            SELECT SUM(el.balance_before - el.balance_after)
            FROM edit_log el
            WHERE el.session_id = s.id
              AND el.player_id = sp.player_id
              AND el.action IN ('buy_in', 'buy_in_dealer_phase2', 'rebuy', 'rebuy_undo')
          ), 0)
          +
          COALESCE((
            SELECT COUNT(*) * COALESCE((SELECT buy_in FROM seasons WHERE id = s.season_id), 100)
            FROM edit_log el
            WHERE el.session_id = s.id
              AND el.player_id = sp.player_id
              AND el.action = 'dealer_salary_chips'
          ), 0)
        )::int AS contributed,
        COALESCE((
          SELECT el.balance_before
          FROM edit_log el
          WHERE el.session_id = s.id
            AND el.player_id = sp.player_id
            AND el.action IN ('buy_in', 'buy_in_dealer_phase2', 'buy_in_dealer_free', 'buy_in_no_gaji_dealer')
          ORDER BY el.created_at ASC
          LIMIT 1
        ), p.balance)::int AS original_balance
      FROM sessions s
      JOIN session_participants sp ON sp.session_id = s.id
      JOIN players p ON p.id = sp.player_id
      WHERE s.status = 'active' AND s.mode = 'offline'
      ORDER BY sp.is_dealer DESC, p.name ASC
    ` as unknown as Promise<ParticipantRow[]>,
    sql`
      SELECT se.current_phase, se.rake_rate
      FROM sessions s
      LEFT JOIN seasons se ON se.id = s.season_id
      WHERE s.status = 'active' AND s.mode = 'offline'
      LIMIT 1
    ` as unknown as Promise<SeasonRow[]>,
  ])

  if (rows.length === 0) return null

  const expectedTotal = rows.reduce((sum, r) => sum + Number(r.contributed), 0)
  const season = seasonRows[0] ?? null
  const isPhase2 = season?.current_phase === 'steady'
  const rakeRate = season?.rake_rate ?? null

  return {
    sessionId: rows[0].session_id,
    startedAt: rows[0].started_at,
    expectedTotal,
    rakeInfo: isPhase2 && rakeRate !== null ? { rakeRate: Number(rakeRate) } : null,
    participants: rows.map((r) => ({
      player_id: r.player_id,
      player_name: r.player_name,
      is_dealer: r.is_dealer,
      no_gaji_dealer: r.no_gaji_dealer,
      rebuy_count: r.rebuy_count,
      current_balance: r.current_balance,
      original_balance: Number(r.original_balance),
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
      rakeInfo={data.rakeInfo}
      startedAt={data.startedAt}
    />
  )
}
