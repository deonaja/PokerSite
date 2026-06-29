'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { getAuthenticatedPlayerId, isAdmin } from '@/lib/auth-server'
import { executeRollback } from '@/lib/rollback'

/**
 * Admin-only. Runs executeRollback in a transaction and writes an audit row.
 *
 * The action itself is wrapped in BEGIN/COMMIT here (not in executeRollback)
 * so the caller controls transaction lifetime; on any error or non-ok result
 * we ROLLBACK and surface the error to the UI.
 */
export async function executeAdminRollback(
  snapshotId: string
): Promise<{ success: true } | { error: string }> {
  if (!(await isAdmin())) return { error: 'Akses ditolak' }
  if (typeof snapshotId !== 'string' || !snapshotId) return { error: 'Snapshot tidak valid' }

  const actorPlayerId = await getAuthenticatedPlayerId()
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const result = await executeRollback(client, snapshotId, actorPlayerId)
    if (!result.ok) {
      await client.query('ROLLBACK')
      return { error: result.error }
    }
    await client.query('COMMIT')

    // Rollback can touch literally any screen — invalidate broadly.
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/session')
    revalidatePath('/session/setup')
    return { success: true }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* noop */ }
    console.error('executeAdminRollback error:', e)
    return { error: 'Gagal rollback' }
  } finally {
    await client.end()
  }
}
