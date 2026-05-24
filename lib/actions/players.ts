'use server'

import { createDbClient } from '@/lib/db'

export async function addPlayer({
  name,
  balance,
  actorPlayerId,
}: {
  name: string
  balance: number
  actorPlayerId: string
}): Promise<{ success: true; playerId: string } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Nama tidak boleh kosong' }
  if (trimmed.length > 50) return { error: 'Nama maksimal 50 karakter' }
  if (!Number.isInteger(balance) || balance < 0 || balance > 100_000) return { error: 'Balance tidak valid (0–100000)' }

  const client = createDbClient()
  await client.connect()
  try {
    const { rows: [player] } = await client.query<{ id: string }>(
      `INSERT INTO players (name, balance) VALUES ($1, $2) RETURNING id`,
      [trimmed, balance]
    )
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'admin_player_add', 0, $3, $4)`,
      [player.id, actorPlayerId || null, balance, JSON.stringify({ name: trimmed })]
    )
    return { success: true, playerId: player.id }
  } catch (e: unknown) {
    const pg = e as { code?: string }
    if (pg.code === '23505') return { error: 'Nama pemain sudah ada' }
    console.error('addPlayer error:', e)
    return { error: 'Gagal menambah pemain' }
  } finally {
    await client.end()
  }
}

export async function editBalance({
  playerId,
  newBalance,
  reason,
  actorPlayerId,
}: {
  playerId: string
  newBalance: number
  reason: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  if (!reason.trim()) return { error: 'Alasan wajib diisi' }
  if (reason.trim().length > 200) return { error: 'Alasan maksimal 200 karakter' }
  if (!Number.isInteger(newBalance) || newBalance < -100_000 || newBalance > 100_000) return { error: 'Balance tidak valid (-100000–100000)' }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    await client.query(`UPDATE players SET balance = $1 WHERE id = $2`, [newBalance, playerId])
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'admin_balance_edit', $3, $4, $5)`,
      [playerId, actorPlayerId || null, player.balance, newBalance, JSON.stringify({ reason: reason.trim() })]
    )

    await client.query('COMMIT')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('editBalance error:', e)
    return { error: 'Gagal edit balance' }
  } finally {
    await client.end()
  }
}
