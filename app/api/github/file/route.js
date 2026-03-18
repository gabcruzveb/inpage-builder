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

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'InPage-Builder' }
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/`

  // Helper: fetch a file from the repo by path
  async function fetchRepoFile(filePath) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      { headers: ghHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
  }

  // Try to find the HTML file
  const filesToTry = path === 'index.html'
    ? ['index.html', 'public/index.html', 'dist/index.html', 'out/index.html']
    : [path]

  for (const filePath of filesToTry) {
    const content = await fetchRepoFile(filePath)
    if (!content) continue

    const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : ''

    // Rewrite relative asset paths (src/href/url()) to absolute raw GitHub URLs
    function rewritePaths(text) {
      return text
        .replace(/(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"']+["'])/g,
          (m, attr, dot, rest) => `${attr}${baseUrl}${fileDir}${rest}`)
        .replace(/url\(['"]?(?!https?:\/\/|\/\/|data:)(\.\/)?([^'")]+)['"]?\)/g,
          (m, dot, rest) => `url('${baseUrl}${fileDir}${rest}')`)
    }

    let html = rewritePaths(content)

    // Inline all linked CSS files so styles render correctly in the editor
    // (avoids CORS issues and makes GrapeJS aware of the styles)
    const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi
    const cssInlines = []
    let match

    while ((match = cssLinkRegex.exec(html)) !== null) {
      const href = match[1]
      // Only inline files from the same repo (already rewritten to raw.githubusercontent.com)
      if (href.startsWith(baseUrl)) {
        const cssPath = href.replace(baseUrl, '')
        const cssContent = await fetchRepoFile(cssPath)
        if (cssContent) {
          // Also rewrite relative paths inside the CSS (background-image: url(...))
          const rewrittenCss = rewritePaths(cssContent)
          cssInlines.push({ tag: match[0], css: rewrittenCss })
        }
      }
    }

    // Replace <link> tags with inlined <style> blocks
    for (const { tag, css } of cssInlines) {
      html = html.replace(tag, `<style>\n${css}\n</style>`)
    }

    return NextResponse.json({ html, path: filePath })
  }

  return NextResponse.json({ error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.` }, { status: 404 })
}
