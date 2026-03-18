import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { processGithubHtml } from '@/lib/github-html-processor'

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

  // Use the user's personal GitHub token (supports private repos)
  const { data: profile } = await auth.client
    .from('profiles').select('github_token').eq('id', auth.user.id).single()

  const token = profile?.github_token
  if (!token) return NextResponse.json({ error: 'GitHub não conectado. Conecte sua conta do GitHub nas configurações.' }, { status: 400 })

  const branch = site.github_branch || 'main'
  const filePath = site.github_path

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' }
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/`

  try {
    // Fetch the HTML file content and its SHA
    const clean = filePath.replace(/^\//, '')
    const res = await fetch(`${apiBase}${clean}?ref=${branch}`, { headers: ghHeaders })
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: `Arquivo "${filePath}" não encontrado no repositório "${site.github_repo}".` }, { status: 404 })
      }
      throw new Error(`GitHub API error: ${res.status}`)
    }

    const data = await res.json()
    const content = data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
    if (!content) return NextResponse.json({ error: 'Arquivo vazio ou ilegível.' }, { status: 400 })

    // Process the HTML: rewrite paths, embed CSS, resolve variables
    const html = await processGithubHtml({
      content,
      rawBase,
      apiBase,
      ghHeaders,
      branch,
      filePath,
    })

    return NextResponse.json({ html, sha: data.sha })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao buscar arquivo do GitHub: ' + err.message }, { status: 500 })
  }
}
