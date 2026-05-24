import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  // ── Admin auth ──────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const keyParam = searchParams.get('key')
    const cookieKey = req.cookies.get('admin_key')?.value
    const adminKey = process.env.ADMIN_KEY

    if (!adminKey) return new NextResponse(null, { status: 404 })

    if (keyParam === adminKey) {
      const url = req.nextUrl.clone()
      url.searchParams.delete('key')
      const res = NextResponse.redirect(url)
      res.cookies.set('admin_key', keyParam, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/admin',
        maxAge: 60 * 60 * 8,
      })
      return res
    }

    if (cookieKey !== adminKey) {
      return new NextResponse(null, { status: 404 })
    }

    return NextResponse.next()
  }

  // ── Identity guard ───────────────────────────────────────────
  const guarded = ['/', '/session']
  const isGuarded = guarded.includes(pathname) || pathname.startsWith('/session/')
  if (isGuarded && !req.cookies.get('playerId')?.value) {
    return NextResponse.redirect(new URL('/identity', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/', '/session', '/session/:path*'],
}
