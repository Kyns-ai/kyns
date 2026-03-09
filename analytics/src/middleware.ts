import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from './lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/auth/')) return NextResponse.next()
  if (pathname.startsWith('/login')) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  const authed = await isAuthenticated(req)
  if (!authed) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/analytics/:path*'],
}
