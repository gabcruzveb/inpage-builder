import { NextResponse } from 'next/server'

// Auth is handled by client-side layouts (supabase stores session in localStorage, not cookies)
export function middleware(request) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
