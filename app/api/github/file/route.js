import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

// Resolve relative path segments (handles ../ and ./)
function normalizePath(base, relative) {
  if (!relative) return base
  if (relative.startsWith('/')) return relative.slice(1)

  const stack = base ? base.split('/') : []
  const parts = relative.split('/')

  for (const part of parts) {
    if (part === '..') {
      if (stack.length > 0) stack.pop()
    } else if (part !== '.') {
      stack.push(part)
    }
  }
  return stack.join('/')
}

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
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/`
  const apiBase = `https://api.github.com/repos/${owner}/${repoName}/contents/`

  async function fetchRepoFile(filePath) {
    const cleanPath = filePath.replace(/^\//, '')
    const res = await fetch(`${apiBase}${cleanPath}?ref=${branch}`, { headers: ghHeaders })
    if (!res.ok) return null
    const data = await res.json()
    return data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
  }

  // Rewrite relative asset paths to absolute raw GitHub URLs
  // fileDir = directory of the file being processed (e.g. "assets/" for "assets/style.css")
  function rewritePaths(text, fileDir = '') {
    // src/href attributes (images, scripts, etc.)
    text = text.replace(
      /(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"']+)(["'])/g,
      (m, attr, dot, rel, quote) => {
        const resolved = normalizePath(fileDir, rel)
        return `${attr}${rawBase}${resolved}${quote}`
      }
    )
    // url() in CSS (background-image, etc.)
    text = text.replace(
      /url\(['"]?(?!https?:\/\/|\/\/|data:|#)(\.\/)?([^'")]+)['"]?\)/g,
      (m, dot, rel) => {
        const resolved = normalizePath(fileDir, rel)
        return `url('${rawBase}${resolved}')`
      }
    )
    return text
  }

  const filesToTry = path === 'index.html'
    ? ['index.html', 'public/index.html', 'dist/index.html', 'out/index.html']
    : [path]

  for (const filePath of filesToTry) {
    const content = await fetchRepoFile(filePath)
    if (!content) continue

    // fileDir is the directory containing index.html (usually '' for root)
    const fileDir = filePath.includes('/')
      ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
      : ''

    let html = rewritePaths(content, fileDir)

    const allCss = []
    const localLinksToRemove = []

    // 1. Find all <link rel="stylesheet"> tags
    const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi
    let match
    while ((match = cssLinkRegex.exec(html)) !== null) {
      const fullTag = match[0]
      const href = match[1]

      // Only fetch and remove LOCAL repo files (not Google Fonts, CDN, etc.)
      const isLocal = !href.startsWith('http') && !href.startsWith('//')
      const isAlreadyRaw = href.startsWith(rawBase)

      if (isLocal || isAlreadyRaw) {
        // Resolve the CSS file path relative to the HTML file's directory
        const cssRelPath = isAlreadyRaw ? href.replace(rawBase, '') : href
        const cssFilePath = normalizePath(fileDir, cssRelPath)
        const cssContent = await fetchRepoFile(cssFilePath)
        if (cssContent) {
          // Rewrite paths inside CSS relative to the CSS file's directory
          const cssDir = cssFilePath.includes('/')
            ? cssFilePath.substring(0, cssFilePath.lastIndexOf('/') + 1)
            : ''
          allCss.push(rewritePaths(cssContent, cssDir))
          localLinksToRemove.push(fullTag)
        }
      }
      // External links (Google Fonts, CDNs) are left in the HTML as-is
    }

    // Remove only the local CSS links we fetched (keep CDN/Google Fonts links)
    for (const tag of localLinksToRemove) {
      html = html.replace(tag, '')
    }

    // 2. Extract <style> blocks from the HTML (move to CSS)
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
