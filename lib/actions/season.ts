'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { hashPin } from '@/lib/auth'
import { evaluateAchievements, type SeasonResultRow } from '@/lib/achievements'

export interface CreateSeasonInput {
  playerNames: string[]
  buyIn: number
  nyawa: number
  startingBalance: number
  bb: number
  sb: number
  maxPool: number
  maxSessions: number
  rakeRate: number
  presetName: string | null
}

export async function createSeason(
  input: CreateSeasonInput
): Promise<{ error: string } | void> {
  const { playerNames, buyIn, nyawa, bb, sb, maxPool, maxSessions, rakeRate, presetName } = input

  const names = playerNames.map((n) => n.trim()).filter(Boolean)
  if (names.length < 2) return { error: 'Minimal 2 pemain' }
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    return { error: 'Nama pemain harus unik' }
  }
  if (!Number.isInteger(buyIn) || buyIn < 10 || buyIn > 100_000) {
    return { error: 'Buy-in tidak valid' }
  }
  if (!Number.isInteger(nyawa) || nyawa < 2 || nyawa > 10) {
    return { error: 'Nyawa tidak valid' }
  }
  // Derive starting_balance server-side (don't trust the client's copy) so
  // starting_balance = buy_in × nyawa always holds.
  const startingBalance = buyIn * nyawa
  if (startingBalance > 1_000_000) return { error: 'Modal awal terlalu besar' }
  if (!Number.isInteger(maxPool) || maxPool < 100) return { error: 'Max pool tidak valid' }
  // Opsi A invariant: max_pool must sit above the initial pool (n × starting_balance),
  // otherwise the season would flip to Phase 2 on the very first session.
  if (maxPool < names.length * startingBalance) return { error: 'Max pool tidak valid' }
  if (!Number.isInteger(maxSessions) || maxSessions < 1) return { error: 'Max sesi tidak valid' }
  if (!Number.isInteger(rakeRate) || rakeRate < 0 || rakeRate > 50) return { error: 'Rake rate tidak valid' }
  const defaultPinHash = await hashPin('1234')
  const client = createDbClient()
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows: activeSeason } = await client.query(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
    )
    if (activeSeason.length > 0) {
      await client.query('ROLLBACK')
      return { error: 'Sudah ada season aktif' }
    }

    const {
      rows: [{ max_number }],
    } = await client.query<{ max_number: number | null }>(`SELECT MAX(number) as max_number FROM seasons`)
    const seasonNumber = (max_number ?? 0) + 1

    const playerIds: string[] = []
    for (const name of names) {
      const { rows: [existing] } = await client.query<{ id: string }>(
        `SELECT id FROM players WHERE LOWER(name) = LOWER($1)`,
        [name]
      )
      if (existing) {
        playerIds.push(existing.id)
        await client.query(`UPDATE players SET balance = $1 WHERE id = $2`, [startingBalance, existing.id])
      } else {
        const { rows: [newPlayer] } = await client.query<{ id: string }>(
          `INSERT INTO players (name, balance, pin_hash) VALUES ($1, $2, $3) RETURNING id`,
          [name, startingBalance, defaultPinHash]
        )
        playerIds.push(newPlayer.id)
      }
    }

    const creatorId = playerIds[0]

    const { rows: [season] } = await client.query<{ id: string }>(
      `INSERT INTO seasons
         (number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, creator_player_id)
       VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [seasonNumber, presetName, startingBalance, buyIn, bb, sb, maxPool, maxSessions, rakeRate, creatorId]
    )

    for (const playerId of playerIds) {
      await client.query(
        `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, 'season_start', 0, $3, $4)`,
        [playerId, creatorId, startingBalance, JSON.stringify({ season_id: season.id, season_number: seasonNumber })]
      )
      // Membership: every chosen player joins the season's roster.
      await client.query(
        `INSERT INTO season_players (season_id, player_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [season.id, playerId]
      )
    }

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/identity')
  } catch (e: unknown) {
    await client.query('ROLLBACK')
    const pg = e as { code?: string }
    if (pg.code === '23505') return { error: 'Nama pemain sudah ada atau season konflik' }
    console.error('createSeason error:', e)
    return { error: 'Gagal membuat season' }
  } finally {
    await client.end()
  }

  redirect('/identity')
}

export async function endSeason(seasonId: string): Promise<{ success: true } | { error: string }> {
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [season] } = await client.query<{
      id: string; number: number; starting_balance: number; status: string
    }>(
      `SELECT id, number, starting_balance, status FROM seasons WHERE id = $1 FOR UPDATE`,
      [seasonId]
    )
    if (!season) { await client.query('ROLLBACK'); return { error: 'Season tidak ditemukan' } }
    if (season.status !== 'active') { await client.query('ROLLBACK'); return { error: 'Season sudah berakhir' } }

    // Auto-settle outstanding loans BEFORE ranking so the leaderboard reflects
    // debts pulled back. For each active loan claw back min(borrower balance,
    // amount) borrower→lender; any shortfall is written off (the lender's loss).
    // Pending (never-disbursed) requests are just cancelled so they don't leak
    // into the next season. Loan edit_log actions stay out of the win/loss stats
    // (the stats query whitelists session actions + requires session_id).
    const { rows: activeLoans } = await client.query<{
      id: string; lender_id: string; borrower_id: string; amount: number
    }>(
      `SELECT id, lender_id, borrower_id, amount FROM loans
       WHERE season_id = $1 AND status = 'active' FOR UPDATE`,
      [seasonId]
    )
    for (const loan of activeLoans) {
      const { rows: lp } = await client.query<{ id: string; balance: number }>(
        `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        [[loan.lender_id, loan.borrower_id]]
      )
      const lender = lp.find((p) => p.id === loan.lender_id)
      const borrower = lp.find((p) => p.id === loan.borrower_id)
      if (!lender || !borrower) continue
      const settle = Math.min(borrower.balance, loan.amount)
      const lenderAfter = lender.balance + settle
      if (settle > 0) {
        await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [settle, loan.borrower_id])
        await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [settle, loan.lender_id])
        await client.query(
          `INSERT INTO edit_log (player_id, action, balance_before, balance_after, metadata)
           VALUES ($1, 'loan_settle', $2, $3, $4)`,
          [loan.borrower_id, borrower.balance, borrower.balance - settle, JSON.stringify({ loan_id: loan.id, to: loan.lender_id })]
        )
        await client.query(
          `INSERT INTO edit_log (player_id, action, balance_before, balance_after, metadata)
           VALUES ($1, 'loan_settle', $2, $3, $4)`,
          [loan.lender_id, lender.balance, lenderAfter, JSON.stringify({ loan_id: loan.id, from: loan.borrower_id })]
        )
      }
      const writeoff = loan.amount - settle
      if (writeoff > 0) {
        // Lender eats the shortfall — record it (no balance change).
        await client.query(
          `INSERT INTO edit_log (player_id, action, balance_before, balance_after, metadata)
           VALUES ($1, 'loan_writeoff', $2, $2, $3)`,
          [loan.lender_id, lenderAfter, JSON.stringify({ loan_id: loan.id, amount: writeoff, borrower_id: loan.borrower_id })]
        )
      }
      await client.query(`UPDATE loans SET status = 'settled', settled_at = now() WHERE id = $1`, [loan.id])
    }
    await client.query(
      `UPDATE loans SET status = 'cancelled' WHERE season_id = $1 AND status = 'pending'`,
      [seasonId]
    )

    // Compute per-player stats across all ended sessions in this season.
    const { rows: stats } = await client.query<{
      player_id: string
      sessions_played: number
      times_dealer: number
      total_won: number
      total_lost: number
    }>(
      `WITH per_session AS (
         SELECT
           sp.player_id,
           sp.session_id,
           sp.is_dealer,
           COALESCE(sp.final_stack, 0)::int AS final_stack,
           COALESCE(SUM(
             CASE
               WHEN el.action IN ('buy_in', 'buy_in_dealer_phase2', 'rebuy')
                 THEN (el.balance_before - el.balance_after)
               WHEN el.action = 'rebuy_undo'
                 THEN (el.balance_before - el.balance_after)
               WHEN el.action = 'dealer_salary_chips'
                 THEN (el.metadata->>'chips')::int
               ELSE 0
             END
           ), 0)::int AS contributed
         FROM sessions s
         JOIN session_participants sp ON sp.session_id = s.id
         LEFT JOIN edit_log el ON el.session_id = s.id
           AND el.player_id = sp.player_id
           AND el.action IN ('buy_in', 'buy_in_dealer_phase2', 'rebuy', 'rebuy_undo', 'dealer_salary_chips')
         WHERE s.season_id = $1 AND s.status = 'ended'
         GROUP BY sp.player_id, sp.session_id, sp.is_dealer, sp.final_stack
       ),
       player_stats AS (
         SELECT
           player_id,
           COUNT(*)::int AS sessions_played,
           COUNT(CASE WHEN is_dealer THEN 1 END)::int AS times_dealer,
           COALESCE(SUM(CASE WHEN final_stack - contributed > 0 THEN final_stack - contributed ELSE 0 END), 0)::int AS total_won,
           COALESCE(SUM(CASE WHEN final_stack - contributed < 0 THEN contributed - final_stack ELSE 0 END), 0)::int AS total_lost
         FROM per_session
         GROUP BY player_id
       )
       SELECT player_id, sessions_played, times_dealer, total_won, total_lost
       FROM player_stats`,
      [seasonId]
    )

    // Rank the season's MEMBERS by current balance (the final state before reset).
    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT p.id, p.balance
       FROM players p
       JOIN season_players mp ON mp.player_id = p.id AND mp.season_id = $1
       ORDER BY p.balance DESC, p.id ASC
       FOR UPDATE OF p`,
      [seasonId]
    )

    const statsMap = new Map(stats.map((s) => [s.player_id, s]))

    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      const s = statsMap.get(p.id) ?? { sessions_played: 0, times_dealer: 0, total_won: 0, total_lost: 0 }
      const rank = i + 1
      await client.query(
        `INSERT INTO season_results
           (season_id, player_id, final_balance, rank, sessions_played, times_dealer, total_won, total_lost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [seasonId, p.id, p.balance, rank, s.sessions_played, s.times_dealer, s.total_won, s.total_lost]
      )
    }

    // Award achievements from each player's full season-results history
    // (incl. the rows just written for this season). Idempotent via the
    // (player_id, achievement_key) unique constraint.
    const { rows: allResults } = await client.query<SeasonResultRow & { player_id: string }>(
      `SELECT sr.player_id, sr.rank, sr.final_balance, sr.sessions_played,
              sr.times_dealer, sr.total_won, sr.total_lost, se.starting_balance
       FROM season_results sr
       JOIN seasons se ON se.id = sr.season_id`
    )
    const resultsByPlayer = new Map<string, SeasonResultRow[]>()
    for (const r of allResults) {
      const list = resultsByPlayer.get(r.player_id) ?? []
      list.push(r)
      resultsByPlayer.set(r.player_id, list)
    }
    for (const [playerId, rows] of resultsByPlayer) {
      for (const key of evaluateAchievements(rows)) {
        await client.query(
          `INSERT INTO player_achievements (player_id, achievement_key, season_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id, achievement_key) DO NOTHING`,
          [playerId, key, seasonId]
        )
      }
    }

    // Reset the season members' balances to starting_balance (leave non-members,
    // who aren't part of this season, untouched).
    await client.query(
      `UPDATE players SET balance = $1
       WHERE id IN (SELECT player_id FROM season_players WHERE season_id = $2)`,
      [season.starting_balance, seasonId]
    )

    // Log season_end for every player.
    for (const p of players) {
      await client.query(
        `INSERT INTO edit_log (player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, 'season_end', $2, $3, $4)`,
        [p.id, p.balance, season.starting_balance, JSON.stringify({ season_id: seasonId, season_number: season.number })]
      )
    }

    await client.query(
      `UPDATE seasons SET status = 'ended', ended_at = now() WHERE id = $1`,
      [seasonId]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/season/end')
    return { success: true as const }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('endSeason error:', e)
    return { error: 'Gagal mengakhiri season' }
  } finally {
    await client.end()
  }
}
