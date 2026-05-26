'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { getAuthenticatedPlayerId } from '@/lib/auth-server'

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

    const deduction = Math.min(player.balance, buyIn)
    await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [deduction, playerId])
    const rebuyRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count + 1 WHERE id = $1`,
      [participant.id]
    )
    if (!rebuyRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Gagal update rebuy' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, $3, 'rebuy', $4, $5, $6)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance - deduction, JSON.stringify({ buy_in: buyIn })]
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

    const { rows: [logEntry] } = await client.query<{ id: string }>(
      `SELECT id FROM edit_log
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

    const { rows: [undoSeason] } = await client.query<{ buy_in: number }>(
      `SELECT s.buy_in FROM seasons s JOIN sessions sess ON sess.season_id = s.id WHERE sess.id = $1`,
      [sessionId]
    )
    const undoBuyIn = undoSeason?.buy_in ?? 100

    await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [undoBuyIn, playerId])
    const undoRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count - 1 WHERE id = $1 AND rebuy_count > 0`,
      [participant.id]
    )
    if (!undoRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Rebuy tidak bisa di-undo' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after)
       VALUES ($1, $2, $3, 'rebuy_undo', $4, $5)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance + undoBuyIn]
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

export async function forceEndSession({
  sessionId,
  actorPlayerId: _actorPlayerId,
}: {
  sessionId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const actorPlayerId = await getAuthenticatedPlayerId()
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(
      `UPDATE sessions SET status = 'ended', ended_at = now() WHERE id = $1 AND status = 'active'`,
      [sessionId]
    )
    if (!rowCount) { await client.query('ROLLBACK'); return { error: 'Sesi tidak ditemukan atau sudah ended' } }

    await client.query(
      `INSERT INTO edit_log (session_id, actor_player_id, action) VALUES ($1, $2, 'admin_session_force_end')`,
      [sessionId, actorPlayerId]
    )
    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/session')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('forceEndSession error:', e)
    return { error: 'Gagal force-end sesi' }
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
}): Promise<{ success: true } | { error: string }> {
  if (!stacks.length) return { error: 'Tidak ada data stack' }
  if (stacks.some((s) => !Number.isInteger(s.finalStack) || s.finalStack < 0)) {
    return { error: 'Stack harus angka >= 0' }
  }

  const actorPlayerId = await getAuthenticatedPlayerId()
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

    const { rows: participants } = await client.query<{ player_id: string; is_dealer: boolean; rebuy_count: number; no_gaji_dealer: boolean }>(
      `SELECT player_id, is_dealer, rebuy_count, no_gaji_dealer FROM session_participants WHERE session_id = $1 FOR UPDATE`,
      [sessionId]
    )
    // Active participants: exclude no-gaji dealer (they have no stack to input)
    const activeParticipants = participants.filter((p) => !p.no_gaji_dealer)
    const participantIds = activeParticipants.map((row) => row.player_id)
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
  dealerId: string
  noGajiDealerId?: string | null
  actorPlayerId: string
}

export async function startSession({
  playerIds,
  dealerId,
  noGajiDealerId,
  actorPlayerId: _actorPlayerId,
}: StartSessionInput): Promise<{ sessionId: string } | { error: string }> {
  if (playerIds.length < 2) return { error: 'Minimal 2 pemain' }
  if (!playerIds.includes(dealerId)) return { error: 'Dealer harus ikut bermain' }

  const actorPlayerId = await getAuthenticatedPlayerId()
  const client = createDbClient()
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows: active } = await client.query(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active.length > 0) {
      await client.query('ROLLBACK')
      return { error: 'Sudah ada sesi aktif' }
    }

    // All players who participate in the chip economy (paid players + dealer)
    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )
    if (players.length !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Beberapa pemain tidak ditemukan' }
    }

    const { rows: [season] } = await client.query<{
      id: string; buy_in: number; max_pool: number; current_phase: string; rake_rate: number
    }>(
      `SELECT id, buy_in, max_pool, current_phase, rake_rate FROM seasons WHERE status = 'active' LIMIT 1`
    )
    const buyIn = season?.buy_in ?? 100

    // Cooldown ONLY applies in Phase 1 (bootstrap) — that's where chips are printed,
    // so anti-abuse matters. Phase 2 (steady) uses rake from actual play.
    if (season?.current_phase === 'bootstrap') {
      const { rows: [dealerCooldown] } = await client.query<{ in_cooldown: boolean }>(
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
      if (dealerCooldown?.in_cooldown) {
        await client.query('ROLLBACK')
        return { error: 'Dealer masih dalam cooldown (belum 2 sesi)' }
      }
    }

    // Check phase transition: bootstrap → steady
    let currentPhase = season?.current_phase ?? 'bootstrap'
    if (currentPhase === 'bootstrap' && season) {
      const { rows: [{ total_chips }] } = await client.query<{ total_chips: number }>(
        `SELECT COALESCE(SUM(balance), 0)::int AS total_chips FROM players`
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

    const { rows: [session] } = await client.query<{ id: string }>(
      `INSERT INTO sessions (dealer_id, status, season_id) VALUES ($1, 'active', $2) RETURNING id`,
      [dealerId, season?.id ?? null]
    )
    const sessionId = session.id

    for (const player of players) {
      const isDealer = player.id === dealerId

      await client.query(
        `INSERT INTO session_participants (session_id, player_id, is_dealer)
         VALUES ($1, $2, $3)`,
        [sessionId, player.id, isDealer]
      )

      if (!isDealer || isPhase2) {
        // Phase 1: non-dealers pay buy_in. Phase 2: everyone pays.
        const deduction = Math.min(player.balance, buyIn)
        await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [deduction, player.id])
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sessionId, player.id, actorPlayerId, isDealer ? 'buy_in_dealer_phase2' : 'buy_in', player.balance, player.balance - deduction]
        )
      } else {
        // Phase 1 dealer: free entry
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after)
           VALUES ($1, $2, $3, 'buy_in_dealer_free', $4, $5)`,
          [sessionId, player.id, actorPlayerId, player.balance, player.balance]
        )
      }
    }

    // No-gaji dealer: add to session without buy-in or salary
    if (noGajiDealerId && !playerIds.includes(noGajiDealerId)) {
      const { rows: [noGajiPlayer] } = await client.query<{ id: string }>(
        `SELECT id FROM players WHERE id = $1`,
        [noGajiDealerId]
      )
      if (noGajiPlayer) {
        await client.query(
          `INSERT INTO session_participants (session_id, player_id, is_dealer, no_gaji_dealer)
           VALUES ($1, $2, false, true)`,
          [sessionId, noGajiDealerId]
        )
        await client.query(
          `INSERT INTO edit_log (session_id, player_id, actor_player_id, action)
           VALUES ($1, $2, $3, 'buy_in_no_gaji_dealer')`,
          [sessionId, noGajiDealerId, actorPlayerId]
        )
      }
    }

    // Update last_dealer_session_id only in Phase 1 (cooldown only relevant there)
    if (!isPhase2) {
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
