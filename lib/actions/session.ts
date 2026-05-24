'use server'

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

    let effectiveBalance = player.balance

    if (effectiveBalance < 100) {
      await client.query(`UPDATE players SET balance = 100 WHERE id = $1`, [playerId])
      await client.query(
        `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, $3, 'top_up', $4, 100, $5)`,
        [sessionId, playerId, actorPlayerId, effectiveBalance, JSON.stringify({ reason: 'auto top-up sebelum rebuy' })]
      )
      effectiveBalance = 100
    }

    await client.query(`UPDATE players SET balance = balance - 100 WHERE id = $1`, [playerId])
    const rebuyRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count + 1 WHERE id = $1`,
      [participant.id]
    )
    if (!rebuyRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Gagal update rebuy' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after)
       VALUES ($1, $2, $3, 'rebuy', $4, $5)`,
      [sessionId, playerId, actorPlayerId, effectiveBalance, effectiveBalance - 100]
    )

    await client.query('COMMIT')
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

    await client.query(`UPDATE players SET balance = balance + 100 WHERE id = $1`, [playerId])
    const undoRow = await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count - 1 WHERE id = $1 AND rebuy_count > 0`,
      [participant.id]
    )
    if (!undoRow.rowCount) { await client.query('ROLLBACK'); return { error: 'Rebuy tidak bisa di-undo' } }

    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after)
       VALUES ($1, $2, $3, 'rebuy_undo', $4, $5)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance + 100]
    )

    await client.query('COMMIT')
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

    const { rows: participants } = await client.query<{ player_id: string }>(
      `SELECT player_id FROM session_participants WHERE session_id = $1 FOR UPDATE`,
      [sessionId]
    )
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
  actorPlayerId: string
}

export async function startSession({
  playerIds,
  dealerId,
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

    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )
    if (players.length !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Beberapa pemain tidak ditemukan' }
    }

    const { rows: [session] } = await client.query<{ id: string }>(
      `INSERT INTO sessions (dealer_id, status) VALUES ($1, 'active') RETURNING id`,
      [dealerId]
    )
    const sessionId = session.id

    for (const player of players) {
      const isDealer = player.id === dealerId

      await client.query(
        `INSERT INTO session_participants (session_id, player_id, is_dealer)
         VALUES ($1, $2, $3)`,
        [sessionId, player.id, isDealer]
      )

      if (!isDealer) {
        let effectiveBalance = player.balance

        if (effectiveBalance < 100) {
          await client.query(`UPDATE players SET balance = 100 WHERE id = $1`, [player.id])
          await client.query(
            `INSERT INTO edit_log
               (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
             VALUES ($1, $2, $3, 'top_up', $4, 100, $5)`,
            [sessionId, player.id, actorPlayerId, effectiveBalance, JSON.stringify({ reason: 'auto top-up sebelum buy-in' })]
          )
          effectiveBalance = 100
        }

        await client.query(`UPDATE players SET balance = balance - 100 WHERE id = $1`, [player.id])
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after)
           VALUES ($1, $2, $3, 'buy_in', $4, $5)`,
          [sessionId, player.id, actorPlayerId, effectiveBalance, effectiveBalance - 100]
        )
      } else {
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after)
           VALUES ($1, $2, $3, 'buy_in_dealer_free', $4, $5)`,
          [sessionId, player.id, actorPlayerId, player.balance, player.balance]
        )
      }
    }

    await client.query('COMMIT')
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
