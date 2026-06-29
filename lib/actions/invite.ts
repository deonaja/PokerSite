'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { getAuthenticatedPlayerId, isAdmin } from '@/lib/auth-server'
import {
  generateInviteCode, generateSessionToken, hashSessionToken, hashPin, isValidPin,
  MAX_INVITE_CODE_USES, MAX_REGISTER_ATTEMPTS, REGISTER_WINDOW_MINUTES,
} from '@/lib/auth'

type Result = { success: true; code: string } | { error: string }

async function clientIpHash(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return hashSessionToken(ip)
}

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

interface JoinSeason {
  id: string
  current_phase: 'bootstrap' | 'steady'
  starting_balance: number
}

// Shared roster-join effect (used by register + existing-player rejoin). Sets a
// phase-aware balance, joins season_players, keeps the phase transition neutral
// in bootstrap (bump max_pool by the same starting_balance the joiner brings),
// and logs the join. The caller owns the transaction + any locks.
async function applySeasonJoin(
  client: ReturnType<typeof createDbClient>,
  season: JoinSeason,
  playerId: string,
  balanceBefore: number,
  via: 'register' | 'rejoin'
) {
  const granted = season.current_phase === 'bootstrap' ? season.starting_balance : 0
  await client.query(`UPDATE players SET balance = $1 WHERE id = $2`, [granted, playerId])
  await client.query(
    `INSERT INTO season_players (season_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [season.id, playerId]
  )
  if (season.current_phase === 'bootstrap') {
    // Phase-neutral: pool and max_pool both rise by starting_balance → the
    // sessions-to-Phase-2 gap is unchanged for everyone (design item 9).
    await client.query(`UPDATE seasons SET max_pool = max_pool + $1 WHERE id = $2`, [season.starting_balance, season.id])
  }
  await client.query(
    `INSERT INTO edit_log (player_id, action, balance_before, balance_after, metadata)
     VALUES ($1, 'season_join', $2, $3, $4)`,
    [playerId, balanceBefore, granted, JSON.stringify({ season_id: season.id, phase: season.current_phase, via })]
  )
}

/**
 * Self-register a NEW player: name + own PIN + the active season's invite code.
 * On success the account is created, auto-joined to the season roster (phase-aware
 * balance), the invite use is consumed (rotates at the limit), and the caller is
 * logged in (auth_session cookie). Per-IP throttle caps wrong-code brute force.
 */
export async function registerPlayer({
  name, pin, code,
}: {
  name: string; pin: string; code: string
}): Promise<{ success: true; playerId: string; name: string } | { error: string }> {
  const trimmedName = name.trim()
  if (trimmedName.length < 1 || trimmedName.length > 30) return { error: 'Nama harus 1-30 karakter' }
  if (!isValidPin(pin)) return { error: 'PIN harus 4-6 digit angka' }
  const codeNorm = code.trim().toUpperCase()
  if (!codeNorm) return { error: 'Kode undangan wajib diisi' }

  const ipHash = await clientIpHash()
  const win = String(REGISTER_WINDOW_MINUTES)
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    // Throttle gate — lock the IP row first (consistent lock order).
    const { rows: [att] } = await client.query<{ attempts: number; in_window: boolean }>(
      `SELECT attempts, (window_start > now() - ($1 || ' minutes')::interval) AS in_window
       FROM register_attempts WHERE ip_hash = $2 FOR UPDATE`,
      [win, ipHash]
    )
    const curAttempts = att?.in_window ? att.attempts : 0
    if (curAttempts >= MAX_REGISTER_ATTEMPTS) {
      await client.query('ROLLBACK')
      return { error: 'Terlalu banyak percobaan. Coba lagi nanti.' }
    }

    const { rows: [season] } = await client.query<JoinSeason & { invite_code: string | null; invite_code_uses: number }>(
      `SELECT id, current_phase, starting_balance, invite_code, invite_code_uses
       FROM seasons WHERE status = 'active' LIMIT 1 FOR UPDATE`
    )
    if (!season) { await client.query('ROLLBACK'); return { error: 'Belum ada season aktif' } }

    // Wrong code → record a throttle attempt and COMMIT it (so failures count).
    if (!season.invite_code || season.invite_code.toUpperCase() !== codeNorm) {
      await client.query(
        `INSERT INTO register_attempts (ip_hash, attempts, window_start) VALUES ($1, 1, now())
         ON CONFLICT (ip_hash) DO UPDATE SET
           attempts = CASE WHEN register_attempts.window_start > now() - ($2 || ' minutes')::interval
                           THEN register_attempts.attempts + 1 ELSE 1 END,
           window_start = CASE WHEN register_attempts.window_start > now() - ($2 || ' minutes')::interval
                           THEN register_attempts.window_start ELSE now() END`,
        [ipHash, win]
      )
      await client.query('COMMIT')
      return { error: 'Kode undangan salah' }
    }

    const { rows: [existing] } = await client.query<{ id: string }>(
      `SELECT id FROM players WHERE LOWER(name) = LOWER($1)`, [trimmedName]
    )
    if (existing) { await client.query('ROLLBACK'); return { error: 'Nama sudah dipakai' } }

    const pinHash = await hashPin(pin)
    const { rows: [newPlayer] } = await client.query<{ id: string }>(
      `INSERT INTO players (name, balance, pin_hash) VALUES ($1, 0, $2) RETURNING id`,
      [trimmedName, pinHash]
    )

    await applySeasonJoin(client, season, newPlayer.id, 0, 'register')

    // Consume an invite use; rotate when the limit is reached.
    const nextUses = season.invite_code_uses + 1
    if (nextUses >= MAX_INVITE_CODE_USES) {
      await client.query(`UPDATE seasons SET invite_code = $1, invite_code_uses = 0 WHERE id = $2`, [generateInviteCode(), season.id])
    } else {
      await client.query(`UPDATE seasons SET invite_code_uses = $1 WHERE id = $2`, [nextUses, season.id])
    }

    // Auto-login.
    const token = generateSessionToken()
    await client.query(
      `INSERT INTO auth_sessions (player_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')`,
      [newPlayer.id, hashSessionToken(token)]
    )

    await client.query('COMMIT')

    const jar = await cookies()
    jar.set('auth_session', token, { path: '/', sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 })
    revalidatePath('/')
    revalidatePath('/identity')
    return { success: true, playerId: newPlayer.id, name: trimmedName }
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => {})
    if ((e as { code?: string }).code === '23505') return { error: 'Nama sudah dipakai' }
    console.error('registerPlayer error:', e)
    return { error: 'Gagal mendaftar' }
  } finally {
    await client.end()
  }
}

/**
 * Existing (logged-in) player who isn't on the active season's roster joins it —
 * no invite code needed (their PIN already vouches for them). Phase-aware balance
 * like registration. Idempotent-ish: errors if already a member.
 */
export async function joinActiveSeason(): Promise<{ success: true } | { error: string }> {
  const playerId = await getAuthenticatedPlayerId()
  if (!playerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rows: [season] } = await client.query<JoinSeason>(
      `SELECT id, current_phase, starting_balance FROM seasons WHERE status = 'active' LIMIT 1 FOR UPDATE`
    )
    if (!season) { await client.query('ROLLBACK'); return { error: 'Belum ada season aktif' } }

    const { rows: [member] } = await client.query(
      `SELECT 1 FROM season_players WHERE season_id = $1 AND player_id = $2`, [season.id, playerId]
    )
    if (member) { await client.query('ROLLBACK'); return { error: 'Kamu sudah ikut musim ini' } }

    const { rows: [p] } = await client.query<{ balance: number }>(
      `SELECT balance FROM players WHERE id = $1 FOR UPDATE`, [playerId]
    )
    if (!p) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    await applySeasonJoin(client, season, playerId, p.balance, 'rejoin')

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/identity')
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('joinActiveSeason error:', e)
    return { error: 'Gagal gabung musim' }
  } finally {
    await client.end()
  }
}
