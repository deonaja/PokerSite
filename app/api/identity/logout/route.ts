import { NextRequest, NextResponse } from 'next/server'
import { createDbClient } from '@/lib/db'
import { hashSessionToken } from '@/lib/auth'

function makeUrl(request: NextRequest, pathname: string) {
  // Honor the proxy's forwarded scheme (https on Vercel).
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('host') ?? 'localhost:3000'
  return new URL(pathname, `${proto}://${host}`)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth_session')?.value

  if (token) {
    const client = createDbClient()
    await client.connect()
    try {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = now()
         WHERE token_hash = $1
           AND revoked_at IS NULL`,
        [hashSessionToken(token)]
      )
    } finally {
      await client.end()
    }
  }

  const response = NextResponse.redirect(makeUrl(request, '/identity'), { status: 303 })
  response.cookies.delete('auth_session')
  response.cookies.delete('playerId')
  response.cookies.delete('playerName')
  return response
}
