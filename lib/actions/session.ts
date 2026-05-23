'use server'

import { createDbClient } from '@/lib/db'

export async function rebuy({
  sessionId,
  playerId,
  actorPlayerId,
}: {
  sessionId: string
  playerId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    const { rows: [session] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND status = 'active'`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    await client.query(`UPDATE players SET balance = balance - 100 WHERE id = $1`, [playerId])
    await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count + 1 WHERE session_id = $1 AND player_id = $2`,
      [sessionId, playerId]
    )
    await client.query(
      `INSERT INTO edit_log (session_id, player_id, actor_player_id, action, balance_before, balance_after)
       VALUES ($1, $2, $3, 'rebuy', $4, $5)`,
      [sessionId, playerId, actorPlayerId, player.balance, player.balance - 100]
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
  actorPlayerId,
}: {
  sessionId: string
  playerId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    // Find latest non-voided rebuy for this player in this session
    const { rows: [logEntry] } = await client.query<{ id: string }>(
      `SELECT id FROM edit_log
       WHERE session_id = $1 AND player_id = $2 AND action = 'rebuy' AND voided = false
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId, playerId]
    )
    if (!logEntry) { await client.query('ROLLBACK'); return { error: 'Tidak ada rebuy untuk di-undo' } }

    await client.query(`UPDATE edit_log SET voided = true WHERE id = $1`, [logEntry.id])
    await client.query(`UPDATE players SET balance = balance + 100 WHERE id = $1`, [playerId])
    await client.query(
      `UPDATE session_participants SET rebuy_count = rebuy_count - 1 WHERE session_id = $1 AND player_id = $2`,
      [sessionId, playerId]
    )
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
  actorPlayerId,
}: {
  sessionId: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
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
      [sessionId, actorPlayerId || null]
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
  actorPlayerId,
}: {
  sessionId: string
  stacks: { playerId: string; finalStack: number }[]
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const playerIds = stacks.map((s) => s.playerId)
    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )

    const { rows: [session] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND status = 'active'`,
      [sessionId]
    )
    if (!session) { await client.query('ROLLBACK'); return { error: 'Sesi tidak aktif' } }

    for (const { playerId, finalStack } of stacks) {
      const player = players.find((p) => p.id === playerId)
      if (!player) continue

      await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [finalStack, playerId])
      await client.query(
        `UPDATE session_participants SET final_stack = $1 WHERE session_id = $2 AND player_id = $3`,
        [finalStack, sessionId, playerId]
      )
      await client.query(
        `INSERT INTO edit_log
           (session_id, player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, $3, 'session_end', $4, $5, $6)`,
        [sessionId, playerId, actorPlayerId, player.balance, player.balance + finalStack,
          JSON.stringify({ final_stack: finalStack })]
      )
    }

    await client.query(
      `UPDATE sessions SET status = 'ended', ended_at = now() WHERE id = $1`,
      [sessionId]
    )

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
  actorPlayerId,
}: StartSessionInput): Promise<{ sessionId: string } | { error: string }> {
  if (playerIds.length < 2) return { error: 'Minimal 2 pemain' }
  if (!playerIds.includes(dealerId)) return { error: 'Dealer harus ikut bermain' }

  const client = createDbClient()
  await client.connect()

  try {
    await client.query('BEGIN')

    // Check no active session exists
    const { rows: active } = await client.query(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active.length > 0) {
      await client.query('ROLLBACK')
      return { error: 'Sudah ada sesi aktif' }
    }

    // Lock all participating players FOR UPDATE (prevent concurrent rebuy/start race)
    const { rows: players } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [playerIds]
    )
    if (players.length !== playerIds.length) {
      await client.query('ROLLBACK')
      return { error: 'Beberapa pemain tidak ditemukan' }
    }

    // Create session
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
        await client.query(
          `UPDATE players SET balance = balance - 100 WHERE id = $1`,
          [player.id]
        )
        await client.query(
          `INSERT INTO edit_log
             (session_id, player_id, actor_player_id, action, balance_before, balance_after)
           VALUES ($1, $2, $3, 'buy_in', $4, $5)`,
          [sessionId, player.id, actorPlayerId, player.balance, player.balance - 100]
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
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('startSession error:', e)
    return { error: 'Gagal memulai sesi' }
  } finally {
    await client.end()
  }
}
