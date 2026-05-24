import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const keyParam = searchParams.get('key')
  const cookieKey = req.cookies.get('admin_key')?.value
  const adminKey = process.env.ADMIN_KEY

  if (!adminKey) return new NextResponse(null, { status: 404 })

  // Valid key in URL → set HttpOnly cookie, redirect without key in URL
  if (keyParam === adminKey) {
    const url = req.nextUrl.clone()
    url.searchParams.delete('key')
    const res = NextResponse.redirect(url)
    res.cookies.set('admin_key', keyParam, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/admin',
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return res
  }

  // No valid cookie → 404
  if (cookieKey !== adminKey) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
