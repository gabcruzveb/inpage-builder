import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

// Get file content from a GitHub repo using user's token
export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')   // e.g. "user/my-site"
  const path = searchParams.get('path') || 'index.html'
  const branch = searchParams.get('branch') || 'main'

  if (!repo) return NextResponse.json({ error: 'repo é obrigatório' }, { status: 400 })

  const { data: profile } = await auth.client
    .from('profiles')
    .select('github_token')
    .eq('id', auth.user.id)
    .single()

  const token = profile?.github_token
  if (!token) return NextResponse.json({ error: 'GitHub não conectado' }, { status: 400 })

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) return NextResponse.json({ error: 'Formato inválido. Use usuario/repositorio' }, { status: 400 })

  // Try to find the HTML file
  const filesToTry = path === 'index.html'
    ? ['index.html', 'public/index.html', 'dist/index.html', 'out/index.html']
    : [path]

  for (const filePath of filesToTry) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' } }
    )

    if (res.ok) {
      const data = await res.json()
      if (data.content) {
        let html = Buffer.from(data.content, 'base64').toString('utf-8')

        // Rewrite relative asset paths to absolute GitHub raw URLs
        // so images, CSS and JS load correctly inside the editor
        const baseUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/`
        const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : ''

        html = html
          // src="assets/..." or src="./assets/..."
          .replace(/(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"']+["'])/g,
            (match, attr, dot, rest) => `${attr}${baseUrl}${fileDir}${rest}`)
          // url('assets/...') in inline styles
          .replace(/url\(['"]?(?!https?:\/\/|\/\/|data:)(\.\/)?([^'")]+)['"]?\)/g,
            (match, dot, rest) => `url('${baseUrl}${fileDir}${rest}')`)

        return NextResponse.json({ html, path: filePath, sha: data.sha })
      }
    }
  }

  return NextResponse.json({ error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.` }, { status: 404 })
}
