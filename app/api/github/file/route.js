import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { processGithubHtml } from '@/lib/github-html-processor'

export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  const path = searchParams.get('path') || 'index.html'
  const branch = searchParams.get('branch') || 'main'

  if (!repo) return NextResponse.json({ error: 'repo é obrigatório' }, { status: 400 })

  const { data: profile } = await auth.client
    .from('profiles').select('github_token').eq('id', auth.user.id).single()

  const token = profile?.github_token
  if (!token) return NextResponse.json({ error: 'GitHub não conectado' }, { status: 400 })

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) return NextResponse.json({ error: 'Formato inválido. Use usuario/repositorio' }, { status: 400 })

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' }
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/`
  const apiBase = `https://api.github.com/repos/${owner}/${repoName}/contents/`

  async function fetchRepoText(filePath) {
    const clean = filePath.replace(/^\//, '')
    const res = await fetch(`${apiBase}${clean}?ref=${branch}`, { headers: ghHeaders })
    if (!res.ok) return null
    const data = await res.json()
    return data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
  }

  const filesToTry = path === 'index.html'
    ? ['index.html', 'public/index.html', 'dist/index.html', 'out/index.html']
    : [path]

  for (const filePath of filesToTry) {
    const content = await fetchRepoText(filePath)
    if (!content) continue

    const html = await processGithubHtml({
      content,
      rawBase,
      apiBase,
      ghHeaders,
      branch,
      filePath,
    })

    return NextResponse.json({ html, path: filePath })
  }

  return NextResponse.json({
    error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.`
  }, { status: 404 })
}
