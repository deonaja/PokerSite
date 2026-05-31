'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { getAuthenticatedPlayerId, isAdmin } from '@/lib/auth-server'
import { hashPin, isValidPin, verifyPin } from '@/lib/auth'

export async function changePin({
  oldPin,
  newPin,
  newPinConfirm,
}: {
  oldPin: string
  newPin: string
  newPinConfirm: string
}): Promise<{ success: true } | { error: string }> {
  if (!isValidPin(newPin)) return { error: 'PIN baru harus 4-6 digit angka' }
  if (newPin !== newPinConfirm) return { error: 'Konfirmasi PIN tidak sama' }

  const playerId = await getAuthenticatedPlayerId()
  if (!playerId) return { error: 'Belum login' }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{ id: string; pin_hash: string | null }>(
      `SELECT id, pin_hash FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    const valid = await verifyPin(oldPin, player.pin_hash)
    if (!valid) { await client.query('ROLLBACK'); return { error: 'PIN lama salah' } }

    const newHash = await hashPin(newPin)
    await client.query(`UPDATE players SET pin_hash = $1 WHERE id = $2`, [newHash, playerId])
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action) VALUES ($1, $1, 'pin_change')`,
      [playerId]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('changePin error:', e)
    return { error: 'Gagal ganti PIN' }
  } finally {
    await client.end()
  }
}

export async function addPlayer({
  name,
  balance,
  pin,
  pinConfirm,
  actorPlayerId: _actorPlayerId,
}: {
  name: string
  balance: number
  pin: string
  pinConfirm: string
  actorPlayerId: string
}): Promise<{ success: true; playerId: string } | { error: string }> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Nama tidak boleh kosong' }
  if (trimmed.length > 50) return { error: 'Nama maksimal 50 karakter' }
  if (!Number.isInteger(balance) || balance < 0 || balance > 100_000) return { error: 'Balance tidak valid (0-100000)' }
  if (!isValidPin(pin)) return { error: 'PIN harus 4-6 digit angka' }
  if (pin !== pinConfirm) return { error: 'Konfirmasi PIN tidak sama' }

  const actorPlayerId = await getAuthenticatedPlayerId()
  const pinHash = await hashPin(pin)
  const client = createDbClient()
  await client.connect()
  try {
    const { rows: [player] } = await client.query<{ id: string }>(
      `INSERT INTO players (name, balance, pin_hash) VALUES ($1, $2, $3) RETURNING id`,
      [trimmed, balance, pinHash]
    )
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'admin_player_add', 0, $3, $4)`,
      [player.id, actorPlayerId, balance, JSON.stringify({ name: trimmed })]
    )
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/session/setup')
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
  actorPlayerId: _actorPlayerId,
}: {
  playerId: string
  newBalance: number
  reason: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  if (!reason.trim()) return { error: 'Alasan wajib diisi' }
  if (reason.trim().length > 200) return { error: 'Alasan maksimal 200 karakter' }
  if (!Number.isInteger(newBalance) || newBalance < 0 || newBalance > 100_000) return { error: 'Balance tidak valid (0-100000)' }

  const actorPlayerId = await getAuthenticatedPlayerId()
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
      [playerId, actorPlayerId, player.balance, newBalance, JSON.stringify({ reason: reason.trim() })]
    )

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('editBalance error:', e)
    return { error: 'Gagal edit balance' }
  } finally {
    await client.end()
  }
}

export async function resetPlayerPin({
  playerId,
  pin,
  pinConfirm,
  reason,
  actorPlayerId: _actorPlayerId,
}: {
  playerId: string
  pin: string
  pinConfirm: string
  reason: string
  actorPlayerId: string
}): Promise<{ success: true } | { error: string }> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  if (!reason.trim()) return { error: 'Alasan reset PIN wajib diisi' }
  if (reason.trim().length > 200) return { error: 'Alasan maksimal 200 karakter' }
  if (!isValidPin(pin)) return { error: 'PIN harus 4-6 digit angka' }
  if (pin !== pinConfirm) return { error: 'Konfirmasi PIN tidak sama' }

  const actorPlayerId = await getAuthenticatedPlayerId()
  const pinHash = await hashPin(pin)
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{ id: string }>(
      `SELECT id FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )
    if (!player) {
      await client.query('ROLLBACK')
      return { error: 'Pemain tidak ditemukan' }
    }

    await client.query(`UPDATE players SET pin_hash = $1 WHERE id = $2`, [pinHash, playerId])
    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = now()
       WHERE player_id = $1
         AND revoked_at IS NULL`,
      [playerId]
    )
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, metadata)
       VALUES ($1, $2, 'admin_pin_reset', $3)`,
      [playerId, actorPlayerId, JSON.stringify({ reason: reason.trim() })]
    )

    await client.query('COMMIT')
    revalidatePath('/admin')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('resetPlayerPin error:', e)
    return { error: 'Gagal reset PIN' }
  } finally {
    await client.end()
  }
}
