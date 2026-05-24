import { NextRequest, NextResponse } from 'next/server'
import { createDbClient } from '@/lib/db'
import { generateSessionToken, hashSessionToken, verifyPin } from '@/lib/auth'

function makeUrl(request: NextRequest, pathname: string) {
  const host = request.headers.get('host') ?? 'localhost:3000'
  return new URL(pathname, `http://${host}`)
}

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
    const { rows: [player] } = await client.query<{ id: string; name: string; pin_hash: string | null }>(
      `SELECT id, name, pin_hash FROM players WHERE id = $1 LIMIT 1`,
      [playerId]
    )

    if (!player) {
      return NextResponse.redirect(makeUrl(request, '/identity?error=invalid'), { status: 303 })
    }

    const pinOk = await verifyPin(pin, player.pin_hash)
    if (!pinOk) {
      return NextResponse.redirect(makeUrl(request, '/identity?error=invalid'), { status: 303 })
    }

    const token = generateSessionToken()
    const tokenHash = hashSessionToken(token)
    await client.query(
      `INSERT INTO auth_sessions (player_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '30 days')`,
      [player.id, tokenHash]
    )

    const response = NextResponse.redirect(makeUrl(request, '/'), { status: 303 })
    response.cookies.set('auth_session', token, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    })
    response.cookies.set('playerId', player.id, { path: '/', sameSite: 'lax' })
    response.cookies.set('playerName', encodeURIComponent(player.name), { path: '/', sameSite: 'lax' })
    return response
  } finally {
    await client.end()
  }
}
