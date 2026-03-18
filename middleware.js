import { NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/admin', '/dashboard', '/editor']

// Routes that are only accessible to unauthenticated users
const AUTH_ROUTES = ['/login']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Check if the route needs protection
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  // Look for Supabase session cookies
  // Supabase stores the session in cookies with the project ref as part of the key
  const cookies = request.cookies
  const allCookies = cookies.getAll()

  // Find Supabase auth token cookie (format: sb-<project-ref>-auth-token)
  const authCookie = allCookies.find(
    (c) =>
      c.name.startsWith('sb-') &&
      (c.name.endsWith('-auth-token') || c.name.endsWith('-auth-token.0') || c.name.endsWith('-auth-token.1'))
  )

  // Also check for the legacy session cookie format
  const legacyAuthCookie = allCookies.find((c) => c.name === 'supabase-auth-token')

  const hasSession = !!(authCookie || legacyAuthCookie)

  // If accessing a protected route without a session, redirect to login
  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If accessing auth routes with an active session, redirect to dashboard
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files, images, and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
