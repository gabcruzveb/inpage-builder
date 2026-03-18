import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function getSessionUser() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Find Supabase auth token
  const authCookie = allCookies.find(
    (c) =>
      c.name.startsWith('sb-') &&
      (c.name.endsWith('-auth-token') || c.name.endsWith('-auth-token.0'))
  )

  if (!authCookie) return null

  try {
    const tokenData = JSON.parse(decodeURIComponent(authCookie.value))
    const accessToken = tokenData?.access_token || tokenData?.[0]
    if (!accessToken) return null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return { user, profile }
  } catch {
    return null
  }
}

export default async function DashboardLayout({ children }) {
  const result = await getSessionUser()

  if (!result) {
    redirect('/login?redirectTo=/dashboard')
  }

  const isAdmin = result.profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #E8922A, #c77a1e)' }}
              >
                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <span className="text-white font-semibold">Page Builder</span>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              {isAdmin && (
                <a
                  href="/admin"
                  className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: '#E8922A', color: '#E8922A' }}
                >
                  Admin
                </a>
              )}
              <span className="text-zinc-400 text-sm hidden sm:block truncate max-w-xs">
                {result.user.email}
              </span>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-red-400 text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
