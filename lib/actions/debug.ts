'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sql, createDbClient } from '@/lib/db'

type Result = { success: true; message: string } | { error: string }

// Debug actions are destructive, so re-verify the admin key cookie (set by the
// proxy after a valid ?key=). The /admin page being gated isn't enough on its own
// since server actions are independently invocable.
async function isAdmin(): Promise<boolean> {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) return false
  const store = await cookies()
  return store.get('admin_key')?.value === adminKey
}

function revalidateAll() {
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/session')
  revalidatePath('/session/setup')
}

/** End the active session (if any) and the active season, so a new one can be created. */
export async function debugResetSeason(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`)
    const { rowCount } = await client.query(`UPDATE seasons SET status = 'ended', ended_at = now() WHERE status = 'active'`)
    await client.query('COMMIT')
    revalidateAll()
    return {
      success: true,
      message: rowCount ? 'Season aktif di-end. Bikin season baru di /season/new.' : 'Tidak ada season aktif.',
    }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('debugResetSeason error:', e)
    return { error: 'Gagal reset season' }
  } finally {
    await client.end()
  }
}

/** Force the active season into bootstrap or steady (for testing Phase 2 / rake). */
export async function debugSetPhase(phase: 'bootstrap' | 'steady'): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  if (phase !== 'bootstrap' && phase !== 'steady') return { error: 'Phase tidak valid' }
  const rows = await sql`UPDATE seasons SET current_phase = ${phase} WHERE status = 'active' RETURNING id`
  revalidateAll()
  return rows.length
    ? { success: true, message: `Phase season aktif → ${phase}.` }
    : { error: 'Tidak ada season aktif.' }
}

/** Set every player's balance to a fixed amount (default = active season starting_balance). */
export async function debugResetBalances(amount?: number): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  let target = amount
  if (target == null) {
    const rows = await sql`SELECT starting_balance FROM seasons WHERE status = 'active' LIMIT 1`
    target = (rows[0] as { starting_balance: number } | undefined)?.starting_balance ?? 200
  }
  if (!Number.isInteger(target) || target < 0 || target > 1_000_000) return { error: 'Jumlah tidak valid' }
  await sql`UPDATE players SET balance = ${target}`
  revalidateAll()
  return { success: true, message: `Semua balance di-set ke ${target}.` }
}

/** Clear dealer cooldown for every player. */
export async function debugClearCooldowns(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  await sql`UPDATE players SET last_dealer_session_id = NULL`
  revalidateAll()
  return { success: true, message: 'Cooldown dealer semua pemain di-reset.' }
}

/** Wipe everything — back to a fresh install. */
export async function debugNukeAll(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    // Break the players → sessions FK first, then delete in dependency order.
    await client.query(`UPDATE players SET last_dealer_session_id = NULL`)
    await client.query(`DELETE FROM edit_log`)
    await client.query(`DELETE FROM session_participants`)
    await client.query(`DELETE FROM season_results`)
    await client.query(`DELETE FROM sessions`)
    await client.query(`DELETE FROM seasons`)
    await client.query(`DELETE FROM auth_sessions`)
    await client.query(`DELETE FROM players`)
    await client.query('COMMIT')
    revalidateAll()
    return { success: true, message: 'Semua data dihapus. DB kosong — buka /season/new buat mulai lagi.' }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('debugNukeAll error:', e)
    return { error: 'Gagal nuke data' }
  } finally {
    await client.end()
  }
}
