'use server'

import { createDbClient } from '@/lib/db'

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
