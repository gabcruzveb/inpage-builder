import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function getAdminUser() {
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

export default async function AdminLayout({ children }) {
  const result = await getAdminUser()

  if (!result) {
    redirect('/login?redirectTo=/admin')
  }

  if (result.profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Admin Nav */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #E8922A, #c77a1e)' }}
              >
                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-white font-semibold">Admin Panel</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-sm hidden sm:block">
                {result.user.email}
              </span>
              <a
                href="/dashboard"
                className="text-zinc-400 hover:text-white text-sm transition-colors"
              >
                Dashboard
              </a>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-zinc-400 hover:text-red-400 text-sm transition-colors"
                >
                  Sair
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
