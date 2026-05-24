import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const playerId = formData.get('playerId') as string
  const playerName = formData.get('playerName') as string
  if (!playerId || !playerName) {
    return NextResponse.redirect(new URL('/identity', request.url))
  }

  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.set('playerId', playerId, { path: '/', sameSite: 'lax' })
  response.cookies.set('playerName', playerName, { path: '/', sameSite: 'lax' })
  return response
}
