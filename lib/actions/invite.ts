'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { isAdmin } from '@/lib/auth-server'
import { generateInviteCode } from '@/lib/auth'

type Result = { success: true; code: string } | { error: string }

/**
 * Admin: rotate the active season's invite code (and reset its use counter).
 * Source of truth for the code is the admin panel. Atomic via FOR UPDATE so a
 * concurrent registration can't race the rotation.
 */
export async function rotateInviteCode(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Unauthorized' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rows: [season] } = await client.query<{ id: string }>(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1 FOR UPDATE`
    )
    if (!season) { await client.query('ROLLBACK'); return { error: 'Tidak ada season aktif' } }
    const code = generateInviteCode()
    await client.query(
      `UPDATE seasons SET invite_code = $1, invite_code_uses = 0 WHERE id = $2`,
      [code, season.id]
    )
    await client.query('COMMIT')
    revalidatePath('/admin')
    return { success: true, code }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('rotateInviteCode error:', e)
    return { error: 'Gagal memutar kode' }
  } finally {
    await client.end()
  }
}
