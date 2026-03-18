import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

// Resolve relative path segments (handles ../ and ./)
function normalizePath(base, relative) {
  if (!relative) return base
  if (relative.startsWith('/')) return relative.slice(1)
  const stack = base ? base.split('/') : []
  const parts = relative.split('/')
  for (const part of parts) {
    if (part === '..') { if (stack.length > 0) stack.pop() }
    else if (part !== '.') stack.push(part)
  }
  return stack.join('/')
}

// Rewrite relative asset URLs to absolute raw GitHub URLs
function rewritePaths(text, rawBase, fileDir = '') {
  // src/href/action attributes
  text = text.replace(
    /(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"'\s>]+)(["'])/g,
    (m, attr, dot, rel, quote) => `${attr}${rawBase}${normalizePath(fileDir, rel)}${quote}`
  )
  // url() in CSS
  text = text.replace(
    /url\(\s*['"]?(?!https?:\/\/|\/\/|data:|#)(\.\/)?([^'"\)\s]+)['"]?\s*\)/g,
    (m, dot, rel) => `url('${rawBase}${normalizePath(fileDir, rel)}')`
  )
  return text
}

// Extract the value of an HTML attribute from a tag string (order-independent)
function getAttr(tag, attr) {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return m ? m[1] : null
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

    const fileDir = filePath.includes('/')
      ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : ''

    // Step 1: Rewrite all relative paths in the HTML to absolute GitHub raw URLs
    let html = rewritePaths(content, rawBase, fileDir)

    // Step 2: Find ALL <link> tags and process stylesheet ones
    // Use a robust tag-level match that works regardless of attribute order
    html = await (async () => {
      const parts = []
      let lastIndex = 0
      const linkTagRegex = /<link\s[^>]*>/gi
      let m

      while ((m = linkTagRegex.exec(html)) !== null) {
        const tag = m[0]
        const rel = getAttr(tag, 'rel')
        const href = getAttr(tag, 'href')

        if (rel && rel.toLowerCase() === 'stylesheet' && href) {
          const isLocal = !href.startsWith('http') && !href.startsWith('//')
          const isRepoRaw = href.startsWith(rawBase)

          if (isLocal || isRepoRaw) {
            // This is a local repo CSS file — fetch and embed as <style>
            const cssRelPath = isRepoRaw ? href.replace(rawBase, '') : href
            const cssFilePath = normalizePath(fileDir, cssRelPath)
            const cssContent = await fetchRepoText(cssFilePath)

            parts.push(html.slice(lastIndex, m.index))

            if (cssContent) {
              const cssDir = cssFilePath.includes('/')
                ? cssFilePath.substring(0, cssFilePath.lastIndexOf('/') + 1) : ''
              const rewrittenCss = rewritePaths(cssContent, rawBase, cssDir)
              parts.push(`<style>\n${rewrittenCss}\n</style>`)
            }
            // else: CSS file not found, skip the link tag entirely

            lastIndex = m.index + tag.length
          }
          // External CDN/Google Fonts links: leave untouched (don't advance lastIndex)
        }
      }

      parts.push(html.slice(lastIndex))
      return parts.join('')
    })()

    // Step 3: Rewrite url() inside any existing <style> blocks
    html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
      return `<style${attrs}>\n${rewritePaths(css, rawBase, fileDir)}\n</style>`
    })

    return NextResponse.json({ html, path: filePath })
  }

  return NextResponse.json({
    error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.`
  }, { status: 404 })
}
