import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
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

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' }
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/`

  async function fetchRepoFile(filePath) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      { headers: ghHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
  }

  // Rewrite relative asset URLs to absolute raw GitHub URLs
  function rewritePaths(text, fileDir = '') {
    return text
      .replace(/(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"']+["'])/g,
        (m, attr, dot, rest) => `${attr}${baseUrl}${fileDir}${rest}`)
      .replace(/url\(['"]?(?!https?:\/\/|\/\/|data:)(\.\/)?([^'")]+)['"]?\)/g,
        (m, dot, rest) => `url('${baseUrl}${fileDir}${rest}')`)
  }

  const filesToTry = path === 'index.html'
    ? ['index.html', 'public/index.html', 'dist/index.html', 'out/index.html']
    : [path]

  for (const filePath of filesToTry) {
    const content = await fetchRepoFile(filePath)
    if (!content) continue

    const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : ''
    let html = rewritePaths(content, fileDir)

    // Collect all CSS: first from linked stylesheets, then from inline <style> blocks
    const allCss = []

    // 1. Fetch and inline linked CSS files
    const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi
    let match
    while ((match = cssLinkRegex.exec(html)) !== null) {
      const href = match[1]
      if (href.startsWith(baseUrl)) {
        const cssPath = href.replace(baseUrl, '')
        const cssContent = await fetchRepoFile(cssPath)
        if (cssContent) {
          allCss.push(rewritePaths(cssContent, fileDir))
        }
      }
    }
    // Remove <link rel="stylesheet"> tags from HTML (CSS will be passed separately)
    html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*\/?>/gi, '')

    // 2. Extract <style> blocks from the HTML
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
      allCss.push(rewritePaths(css, fileDir))
      return ''
    })

    const css = allCss.join('\n\n')

    return NextResponse.json({ html, css, path: filePath })
  }

  return NextResponse.json({
    error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.`
  }, { status: 404 })
}
