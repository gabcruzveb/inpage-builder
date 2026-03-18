import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { Octokit } from '@octokit/rest'

export async function POST(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params

  // Verify site ownership
  const { data: site } = await auth.client
    .from('sites')
    .select('github_repo, github_path, github_branch, owner_id')
    .eq('id', siteId)
    .single()

  if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  const isAdmin = auth.profile?.role === 'admin'
  if (!isAdmin && site.owner_id !== auth.user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  if (!site.github_repo || !site.github_path) {
    return NextResponse.json({ error: 'Configure o repositório GitHub primeiro nas configurações do editor.' }, { status: 400 })
  }

  const [owner, repo] = site.github_repo.split('/')
  if (!owner || !repo) {
    return NextResponse.json({ error: 'Repositório inválido. Use o formato: usuario/repositorio' }, { status: 400 })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) return NextResponse.json({ error: 'GitHub token não configurado' }, { status: 500 })

  try {
    const octokit = new Octokit({ auth: token })
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: site.github_path,
      ref: site.github_branch || 'main',
    })

    const html = Buffer.from(response.data.content, 'base64').toString('utf-8')
    return NextResponse.json({ html, sha: response.data.sha })
  } catch (err) {
    if (err.status === 404) {
      return NextResponse.json({ error: `Arquivo "${site.github_path}" não encontrado no repositório "${site.github_repo}".` }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao buscar arquivo do GitHub: ' + err.message }, { status: 500 })
  }
}
