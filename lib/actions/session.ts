'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { getAuthenticatedPlayerId, isAdmin } from '@/lib/auth-server'
import { deriveParticipantTreatment } from '@/lib/economy'

export async function rebuy({
  sessionId,
  playerId,
  actorPlayerId: _actorPlayerId,
}: {
  sessionId: string
  playerId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [session] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    const { rows: [participant] } = await client.query<{ id: string }>(
      `SELECT id FROM session_participants WHERE session_id = $1 AND player_id = $2 FOR UPDATE`,
      [sessionId, playerId]
    )
    if (!participant) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ikut sesi ini' } }

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    const { rows: [sessionSeason] } = await client.query<{ buy_in: number }>(
      `SELECT s.buy_in FROM seasons s JOIN sessions sess ON sess.season_id = s.id WHERE sess.id = $1`,
      [sessionId]
    )
    const buyIn = sessionSeason?.buy_in ?? 100

    // Partial rebuy: a player may rebuy even when balance < buy_in, taking only
    // what they have left (balance never goes negative). Nothing to rebuy at 0.
    if (player.balance <= 0) {
      await client.query('ROLLBACK')
      return { error: 'Saldo habis, tidak bisa rebuy' }
    }
    const rebuyAmount = Math.min(buyIn, player.balance)

    await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [rebuyAmount, playerId])
    const rebuyRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count + 1 WHERE id = $1`,
      [participant.id]
    )
    if (!rebuyRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Gagal update rebuy' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, $3, 'rebuy', $4, $5, $6)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance - rebuyAmount, JSON.stringify({ buy_in: rebuyAmount })]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('rebuy error:', e)
    return { error: 'Gagal rebuy' }
  } finally {
    await client.end()
  }
}

export async function undoRebuy({
  sessionId,
  playerId,
  actorPlayerId: _actorPlayerId,
}: {
  sessionId: string
  playerId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [session] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    const { rows: [participant] } = await client.query<{ id: string }>(
      `SELECT id FROM session_participants WHERE session_id = $1 AND player_id = $2 FOR UPDATE`,
      [sessionId, playerId]
    )
    if (!participant) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ikut sesi ini' } }

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    const { rows: [logEntry] } = await client.query<{ id: string; balance_before: number; balance_after: number }>(
      `SELECT id, balance_before, balance_after FROM edit_log
       WHERE session_id = $1 AND player_id = $2 AND action = 'rebuy' AND voided = false
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [sessionId, playerId]
    )
    if (!logEntry) { await client.query('ROLLBACK'); return { error: 'Tidak ada rebuy untuk di-undo' } }

    const voided = await client.query(
      `UPDATE edit_log SET voided = true WHERE id = $1 AND voided = false`,
      [logEntry.id]
    )
    if (!voided.rowCount) { await client.query('ROLLBACK'); return { error: 'Rebuy sudah di-undo' } }

    // Restore exactly what that rebuy deducted (handles partial rebuys, not a
    // fixed buy_in), so undo is a true reversal of the balance change.
    const undoAmount = logEntry.balance_before - logEntry.balance_after

    await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [undoAmount, playerId])
    const undoRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count - 1 WHERE id = $1 AND rebuy_count > 0`,
      [participant.id]
    )
    if (!undoRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Rebuy tidak bisa di-undo' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after)
       VALUES ($1, $2, $3, 'rebuy_undo', $4, $5)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance + undoAmount]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('undoRebuy error:', e)
    return { error: 'Gagal undo rebuy' }
  } finally {
    await client.end()
  }
}

export async function joinSession({
  sessionId,
  playerId,
}: {
  sessionId: string
  playerId: string
}): Promise<{ success: true } | { error: string }> {
  // LATE JOIN: a member who arrived after the session started buys in mid-game.
  // They always enter as a regular player (the dealer was fixed at start) and must
  // afford the full buy-in — low-balance players can only sit as the dealer, so a
  // broke late-comer must top up (e.g. via a loan) first. Reconciliation carries
  // automatically: the end-wizard derives each player's delta from the FIRST
  // edit_log entry, which for a late joiner is this buy-in, so their result and the
  // session chip total come out right with no special-casing.
  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    // Lock the active session row — all joins/rebuys/end on this session serialize
    // here, so the duplicate-participant re-check below reliably sees a rival commit.
    const { rows: [session] } = await client.query<{ id: string; season_id: string | null }>(
      `SELECT id, season_id FROM sessions WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    const { rows: [existing] } = await client.query<{ id: string }>(
      `SELECT id FROM session_participants WHERE session_id = $1 AND player_id = $2`,
      [sessionId, playerId]
    )
    if (existing) { await client.query('ROLLBACK'); return { error: 'Pemain sudah ikut sesi ini' } }

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    const { rows: [season] } = await client.query<{ buy_in: number }>(
      `SELECT buy_in FROM seasons WHERE id = $1`,
      [session.season_id]
    )
    const buyIn = season?.buy_in ?? 100

    // Server actions self-authorize: only a member of this season's roster may join.
    const { rows: [member] } = await client.query<{ ok: number }>(
      `SELECT 1 AS ok FROM season_players WHERE season_id = $1 AND player_id = $2`,
      [session.season_id, playerId]
    )
    if (!member) { await client.query('ROLLBACK'); return { error: 'Pemain bukan anggota musim ini' } }

    if (player.balance < buyIn) {
      await client.query('ROLLBACK')
      return { error: 'Saldo kurang untuk gabung (minimal 1 buy-in)' }
    }

    await client.query(
      `INSERT INTO session_participants (session_id, player_id, is_dealer, no_gaji_dealer, dealer_plays)
       VALUES ($1, $2, false, false, true)`,
      [sessionId, playerId]
    )
    await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [buyIn, playerId])
    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, $3, 'buy_in', $4, $5, $6)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance - buyIn,
       JSON.stringify({ buy_in: buyIn, late_join: true })]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    return { success: true }
  } catch (e: unknown) {
    await client.query('ROLLBACK')
    const pg = e as { code?: string }
    if (pg.code === '23505') return { error: 'Pemain sudah ikut sesi ini' }
    console.error('joinSession error:', e)
    return { error: 'Gagal gabung sesi' }
  } finally {
    await client.end()
  }
}

export async function cancelSession({
  sessionId,
}: {
  sessionId: string
}): Promise<{ success: true } | { error: string }> {
  // Allowed for admin OR the player who started the session. Refunds every
  // participant back to their pre-session balance (reverses all buy-ins /
  // rebuys), then removes the session entirely — as if it never happened — so
  // it doesn't pollute end-of-season stats and the active-session slot is
  // freed. A per-player 'admin_session_cancel' audit entry is appended.
  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const callerIsAdmin = await isAdmin()
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [session] } = await client.query<{ id: string; creator_player_id: string | null }>(
      `SELECT id, creator_player_id FROM sessions WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak ditemukan atau sudah ended' } }

    const callerIsCreator =
      session.creator_player_id != null && session.creator_player_id === actorPlayerId
    if (!callerIsAdmin && !callerIsCreator) {
      await client.query('ROLLBACK')
      return { error: 'Hanya admin atau pemulai sesi yang bisa membatalkan' }
    }

    // Net amount this session deducted from each player's persistent balance.
    // A free-entry dealer nets 0; a rebuy_undo naturally cancels its rebuy.
    const { rows: refunds } = await client.query<{ player_id: string; refund: number }>(
      `SELECT player_id, SUM(balance_before - balance_after)::int AS refund
         FROM edit_log
        WHERE session_id = $1
          AND player_id IS NOT NULL
          AND balance_before IS NOT NULL
          AND balance_after IS NOT NULL
        GROUP BY player_id`,
      [sessionId]
    )

    for (const { player_id, refund } of refunds) {
      const { rows: [player] } = await client.query<{ balance: number }>(
        `SELECT balance FROM players WHERE id = $1 FOR UPDATE`,
        [player_id]
      )
      if (!player) continue
      if (refund !== 0) {
        await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [refund, player_id])
      }
      // Audit entry is intentionally session_id = NULL so it survives the
      // session delete below and stays out of the per-session accounting.
      await client.query(
        `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, 'admin_session_cancel', $3, $4, $5)`,
        [player_id, actorPlayerId, player.balance, player.balance + refund,
         JSON.stringify({ cancelled_session_id: sessionId, refund })]
      )
    }

    // Reverse the dealer cooldown anchor if it pointed at this session (FK is
    // RESTRICT), then wipe the session's economic log + the session itself
    // (participants cascade). The NULL-session audit rows above are untouched.
    await client.query(`UPDATE players SET last_dealer_session_id = NULL WHERE last_dealer_session_id = $1`, [sessionId])
    await client.query(`DELETE FROM edit_log WHERE session_id = $1`, [sessionId])
    await client.query(`DELETE FROM session_participants WHERE session_id = $1`, [sessionId])
    await client.query(`DELETE FROM sessions WHERE id = $1`, [sessionId])

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    revalidatePath('/session/setup')
    revalidatePath('/admin')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('cancelSession error:', e)
    return { error: 'Gagal membatalkan sesi' }
  } finally {
    await client.end()
  }
}

export async function endSession({
  sessionId,
  stacks,
  actorPlayerId: _actorPlayerId,
}: {
  sessionId: string
  stacks: { playerId: string; finalStack: number }[]
  actorPlayerId: string
}): Promise<{ success: true; seasonOver?: true; seasonId?: string } | { error: string }> {
  if (!stacks.length) return { error: 'Tidak ada data stack' }
  if (stacks.some((s) => !Number.isInteger(s.finalStack) || s.finalStack < 0)) {
    return { error: 'Stack harus angka >= 0' }
  }

  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [session] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    const playerIds = stacks.map((s) => s.playerId)
    if (new Set(playerIds).size !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Data stack duplikat' }
    }

    const { rows: participants } = await client.query<{ player_id: string }>(
      `SELECT player_id FROM session_participants WHERE session_id = $1 FOR UPDATE`,
      [sessionId]
    )
    // Everyone (including a deals-only dealer, who may hold rake/tip chips) inputs a stack.
    const participantIds = participants.map((row) => row.player_id)
    if (participantIds.length !== stacks.length) {
      await client.query('ROLLBACK')
      return { error: 'Data stack harus lengkap untuk semua peserta' }
    }

    const participantSet = new Set(participantIds)
    if (playerIds.some((id) => !participantSet.has(id))) {
      await client.query('ROLLBACK')
      return { error: 'Ada pemain yang tidak ikut sesi ini' }
    }

    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )
    if (players.length !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Beberapa pemain tidak ditemukan' }
    }

    // Approach C: dealer's stack already includes any rake they collected during play.
    // No special handling — everyone gets `balance += final_stack`.
    for (const { playerId, finalStack } of stacks) {
      const player = players.find((p) => p.id === playerId)
      if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

      await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [finalStack, playerId])
      const participantUpdate = await client.query(
        `UPDATE session_participants SET final_stack = $1 WHERE session_id = $2 AND player_id = $3`,
        [finalStack, sessionId, playerId]
      )
      if (!participantUpdate.rowCount) { await client.query('ROLLBACK'); return { error: 'Gagal simpan stack akhir' } }

      await client.query(
        `INSERT INTO edit_log
           (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, $3, 'session_end', $4, $5, $6)`,
        [
          sessionId,
          playerId,
          actorPlayerId,
          player.balance,
          player.balance + finalStack,
          JSON.stringify({ final_stack: finalStack }),
        ]
      )
    }

    const ended = await client.query(
      `UPDATE sessions SET status = 'ended', ended_at = now() WHERE id = $1 AND status = 'active'`,
      [sessionId]
    )
    if (!ended.rowCount) { await client.query('ROLLBACK'); return { error: 'Sesi sudah berakhir' } }

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    revalidatePath('/session/end')

    // Check if the season is now over (sessions played >= max_sessions).
    // This is a post-commit read — safe since the session is already ended.
    const { rows: [seasonCheck] } = await client.query<{ season_id: string }>(
      `SELECT se.id AS season_id
       FROM seasons se
       JOIN sessions s ON s.season_id = se.id AND s.id = $1
       WHERE se.status = 'active'
         AND (SELECT COUNT(*) FROM sessions s2 WHERE s2.season_id = se.id AND s2.status = 'ended') >= se.max_sessions
       LIMIT 1`,
      [sessionId]
    )
    if (seasonCheck) {
      return { success: true, seasonOver: true, seasonId: seasonCheck.season_id }
    }
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('endSession error:', e)
    return { error: 'Gagal mengakhiri sesi' }
  } finally {
    await client.end()
  }
}

interface StartSessionInput {
  playerIds: string[]
  // The dealer is one of the selected participants. Treatment is derived:
  //   PLAYING dealer (dealerPlays = true, default):
  //     - Phase 1 & not in cooldown → free entry + 2× buy_in split salary
  //       (1× table chips + 1× bankroll), plays.
  //     - else if can afford buy-in → pays buy-in and plays.
  //     - else → deals only (no ante, no salary).
  //   NEUTRAL dealer (dealerPlays = false; needs 4+ players so 3 still play):
  //     - Phase 1 & not in cooldown → flat 1× buy_in salary (table chips), no play.
  //     - else → deals only (no salary, 0 chips); in Phase 2 collects the rake.
  dealerId: string
  dealerPlays?: boolean
  actorPlayerId: string
}

export async function startSession({
  playerIds,
  dealerId,
  dealerPlays = true,
  actorPlayerId: _actorPlayerId,
}: StartSessionInput): Promise<{ sessionId: string } | { error: string }> {
  if (playerIds.length < 2) return { error: 'Minimal 2 pemain' }
  if (!playerIds.includes(dealerId)) return { error: 'Dealer harus salah satu pemain' }
  if (!dealerPlays && playerIds.length < 4) {
    return { error: 'Dealer netral butuh minimal 4 pemain (3 main + 1 dealer)' }
  }

  const actorPlayerId = await getAuthenticatedPlayerId()
  if (!actorPlayerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()

  try {
    await client.query('BEGIN')

    // Acquire player row locks FIRST. Concurrent starts that share a player
    // serialize here, so the re-check below reliably sees a rival's committed
    // session and fails with the right error.
    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )
    if (players.length !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Beberapa pemain tidak ditemukan' }
    }

    const { rows: active } = await client.query(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active.length > 0) {
      await client.query('ROLLBACK')
      return { error: 'Sudah ada sesi aktif' }
    }

    const { rows: [season] } = await client.query<{
      id: string; buy_in: number; max_pool: number; current_phase: string; rake_rate: number
    }>(
      `SELECT id, buy_in, max_pool, current_phase, rake_rate FROM seasons WHERE status = 'active' LIMIT 1`
    )
    const buyIn = season?.buy_in ?? 100

    // Non-dealer players must be able to afford the buy-in. A low-balance player
    // can only join as the dealer (where the salary chips let them play).
    const brokeNonDealer = players.find((p) => p.id !== dealerId && p.balance < buyIn)
    if (brokeNonDealer) {
      await client.query('ROLLBACK')
      return { error: 'Pemain balance kurang harus jadi dealer atau jangan dipilih' }
    }

    // Check phase transition: bootstrap → steady
    let currentPhase = season?.current_phase ?? 'bootstrap'
    if (currentPhase === 'bootstrap' && season) {
      const { rows: [{ total_chips }] } = await client.query<{ total_chips: number }>(
        `SELECT COALESCE(SUM(p.balance), 0)::int AS total_chips
         FROM players p
         JOIN season_players mp ON mp.player_id = p.id AND mp.season_id = $1`,
        [season.id]
      )
      if (total_chips >= season.max_pool) {
        await client.query(
          `UPDATE seasons SET current_phase = 'steady' WHERE id = $1`,
          [season.id]
        )
        currentPhase = 'steady'
      }
    }
    const isPhase2 = currentPhase === 'steady'

    // Cooldown only matters in Phase 1, and it no longer BLOCKS — it just denies
    // the dealer the free-entry salary (they pay buy-in like everyone instead).
    let dealerInCooldown = false
    if (!isPhase2) {
      const { rows: [cd] } = await client.query<{ in_cooldown: boolean }>(
        `SELECT
           CASE
             WHEN last_dealer_session_id IS NULL THEN false
             ELSE (
               SELECT COUNT(*) FROM sessions s
               WHERE s.started_at > (SELECT started_at FROM sessions WHERE id = p.last_dealer_session_id)
               AND s.status IN ('active', 'ended')
             ) < 2
           END AS in_cooldown
         FROM players p WHERE id = $1`,
        [dealerId]
      )
      dealerInCooldown = cd?.in_cooldown ?? false
    }
    // Free-entry salary: Phase 1 only, and only when not in cooldown.
    const dealerFreeEntry = !isPhase2 && !dealerInCooldown

    const { rows: [session] } = await client.query<{ id: string }>(
      `INSERT INTO sessions (dealer_id, status, season_id, creator_player_id)
       VALUES ($1, 'active', $2, $3) RETURNING id`,
      [dealerId, season?.id ?? null, actorPlayerId]
    )
    const sessionId = session.id

    let dealerGotSalary = false
    let dealerGotSalaryChips = false
    let dealerSalaryBankrollHalf = false
    for (const player of players) {
      const isDealer = player.id === dealerId
      // Dealer/buy-in matrix lives in lib/economy.ts (pure + unit-tested).
      const { deduction, action, noGaji, salaryChips, salaryBankroll } =
        deriveParticipantTreatment({
          isDealer,
          dealerPlays,
          dealerFreeEntry,
          balance: player.balance,
          buyIn,
        })
      if (isDealer && salaryChips) {
        dealerGotSalary = true
        dealerGotSalaryChips = true
        if (salaryBankroll) dealerSalaryBankrollHalf = true
      }

      await client.query(
        `INSERT INTO session_participants (session_id, player_id, is_dealer, no_gaji_dealer, dealer_plays)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, player.id, isDealer, noGaji, isDealer ? dealerPlays : true]
      )
      if (deduction !== 0) {
        await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [deduction, player.id])
      }
      await client.query(
        `INSERT INTO edit_log
           (session_id, player_id, actor_player_id, action, balance_before, balance_after)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, player.id, actorPlayerId, action, player.balance, player.balance - deduction]
      )
    }

    // Phase 1 dealer salary as chips on the table (1× buy_in): printed, played
    // with, counted in the end-session chip reconciliation (`dealer_salary_chips`).
    // A PLAYING free dealer additionally gets the BANKROLL half (another 1× buy_in
    // credited to balance = the 2× split spare life); a NEUTRAL dealer does not.
    // `dealer_salary_balance` is EXCLUDED from win/loss stats (salary, not winnings).
    if (dealerGotSalaryChips) {
      const dealerPlayer = players.find((p) => p.id === dealerId)!
      // Table half: on the table, no balance change here.
      await client.query(
        `INSERT INTO edit_log
           (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, $3, 'dealer_salary_chips', $4, $4, $5)`,
        [sessionId, dealerId, actorPlayerId, dealerPlayer.balance, JSON.stringify({ chips: buyIn })]
      )
      // Bankroll half: PLAYING free dealer only (2× split). Credit immediately.
      if (dealerSalaryBankrollHalf) {
        await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [buyIn, dealerId])
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
           VALUES ($1, $2, $3, 'dealer_salary_balance', $4, $5, $6)`,
          [sessionId, dealerId, actorPlayerId, dealerPlayer.balance, dealerPlayer.balance + buyIn, JSON.stringify({ chips: buyIn })]
        )
      }
    }

    // Cooldown anchor is set only when the dealer actually received the salary.
    if (dealerGotSalary) {
      await client.query(
        `UPDATE players SET last_dealer_session_id = $1 WHERE id = $2`,
        [sessionId, dealerId]
      )
    }

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    revalidatePath('/session/setup')
    return { sessionId }
  } catch (e: unknown) {
    await client.query('ROLLBACK')
    const pg = e as { code?: string }
    if (pg.code === '23505' || pg.code === '40P01') return { error: 'Sudah ada sesi aktif' }
    console.error('startSession error:', e)
    return { error: 'Gagal memulai sesi' }
  } finally {
    await client.end()
  }
}
