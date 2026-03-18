import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

// List user's GitHub repos using their stored GitHub token
export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Get GitHub token from profile
  const { data: profile } = await auth.client
    .from('profiles')
    .select('github_token, github_username')
    .eq('id', auth.user.id)
    .single()

  const token = profile?.github_token
  if (!token) {
    return NextResponse.json({ error: 'GitHub não conectado. Conecte sua conta do GitHub primeiro.' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || 1

  const res = await fetch(
    `https://api.github.com/user/repos?sort=updated&per_page=30&page=${page}&type=all`,
    { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' } }
  )

  if (!res.ok) {
    if (res.status === 401) {
      return NextResponse.json({ error: 'Token do GitHub expirado. Reconecte sua conta.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro ao buscar repositórios' }, { status: 500 })
  }

  const repos = await res.json()
  return NextResponse.json({
    repos: repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      default_branch: r.default_branch,
      updated_at: r.updated_at,
      html_url: r.html_url,
    })),
    username: profile?.github_username,
  })
}
