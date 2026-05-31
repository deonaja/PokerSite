import { NextRequest, NextResponse } from 'next/server'
import { createDbClient } from '@/lib/db'
import { generateSessionToken, hashSessionToken, verifyPin } from '@/lib/auth'

function makeUrl(request: NextRequest, pathname: string) {
  // Honor the proxy's forwarded scheme (https on Vercel) so we don't 303 to an
  // http:// URL that then has to be upgraded.
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? 'localhost:3000'
  return new URL(pathname, `${proto}://${host}`)
}

// PIN brute-force throttle (per player). 4-digit PINs + public playerIds make
// the login endpoint trivially fuzzable without this; here, MAX_ATTEMPTS
// consecutive failures lock the player for LOCK_MINUTES. Reset on success.
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const playerId = (formData.get('playerId') as string | null)?.trim() ?? ''
  const pin = (formData.get('pin') as string | null)?.trim() ?? ''

  if (!playerId || !pin) {
    return NextResponse.redirect(makeUrl(request, '/identity?error=missing'), { status: 303 })
  }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [player] } = await client.query<{
      id: string
      name: string
      pin_hash: string | null
      failed_attempts: number
      is_locked: boolean
    }>(
      `SELECT id, name, pin_hash, failed_attempts,
              (locked_until IS NOT NULL AND locked_until > now()) AS is_locked
       FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    )

    if (!player) {
      await client.query('ROLLBACK')
      return NextResponse.redirect(makeUrl(request, '/identity?error=invalid'), { status: 303 })
    }

    // Locked: reject without even checking the PIN (don't extend the window).
    if (player.is_locked) {
      await client.query('ROLLBACK')
      return NextResponse.redirect(makeUrl(request, '/identity?error=locked'), { status: 303 })
    }

    const pinOk = await verifyPin(pin, player.pin_hash)
    if (!pinOk) {
      // On the Nth failure, lock and reset the counter to 0 — so each post-lock
      // window grants a fresh MAX_ATTEMPTS, capping the brute-force rate.
      const nextAttempts = player.failed_attempts + 1
      const justLocked = nextAttempts >= MAX_ATTEMPTS
      await client.query(
        `UPDATE players
         SET failed_attempts = $1,
             locked_until = CASE WHEN $2 THEN now() + ($3 || ' minutes')::interval ELSE NULL END
         WHERE id = $4`,
        [justLocked ? 0 : nextAttempts, justLocked, String(LOCK_MINUTES), player.id]
      )
      await client.query('COMMIT')
      return NextResponse.redirect(
        makeUrl(request, justLocked ? '/identity?error=locked' : '/identity?error=invalid'),
        { status: 303 }
      )
    }

    // Success: clear any failure state, then mint the session.
    await client.query(
      `UPDATE players SET failed_attempts = 0, locked_until = NULL WHERE id = $1`,
      [player.id]
    )

    const token = generateSessionToken()
    const tokenHash = hashSessionToken(token)
    await client.query(
      `INSERT INTO auth_sessions (player_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '7 days')`,
      [player.id, tokenHash]
    )
    await client.query('COMMIT')

    const response = NextResponse.redirect(makeUrl(request, '/'), { status: 303 })
    response.cookies.set('auth_session', token, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
    })
    // Identity for the client comes from localStorage (IdentityPicker /
    // LocalStorageSync); server-side it's derived from auth_session → DB. The
    // old non-httpOnly playerId/playerName cookies were never read anywhere, so
    // we don't set them. Logout still clears any left in existing browsers.
    return response
  } finally {
    await client.end()
  }
}
