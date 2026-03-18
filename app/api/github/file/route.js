import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import juice from 'juice'

// Resolve relative path segments (handles ../ and ./)
function normalizePath(base, relative) {
  if (!relative) return base
  if (relative.startsWith('/')) return relative.slice(1)
  const stack = base ? base.split('/') : []
  for (const part of relative.split('/')) {
    if (part === '..') { if (stack.length > 0) stack.pop() }
    else if (part !== '.') stack.push(part)
  }
  return stack.join('/')
}

// Rewrite relative URLs to absolute raw GitHub URLs
function rewritePaths(text, rawBase, fileDir = '') {
  text = text.replace(
    /(\s(?:src|href|action)=["'])(?!https?:\/\/|\/\/|#|data:|mailto:)(\.\/)?([^"'\s>]+)(["'])/g,
    (m, attr, dot, rel, quote) => `${attr}${rawBase}${normalizePath(fileDir, rel)}${quote}`
  )
  text = text.replace(
    /url\(\s*['"]?(?!https?:\/\/|\/\/|data:|#)(\.\/)?([^'"\)\s]+)['"]?\s*\)/g,
    (m, dot, rel) => `url('${rawBase}${normalizePath(fileDir, rel)}')`
  )
  return text
}

// Extract attribute value from an HTML tag string (order-independent)
function getAttr(tag, attr) {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return m ? m[1] : null
}

// Resolve CSS custom properties (CSS variables)
// e.g. :root { --primary: #E8922A } → replaces all var(--primary) with #E8922A
function resolveCssVars(css) {
  const vars = {}

  // Extract all variable definitions from :root and html blocks
  const rootBlocks = css.match(/(?::root|html)\s*\{([^}]*)\}/g) || []
  for (const block of rootBlocks) {
    const inner = block.replace(/(?::root|html)\s*\{/, '').replace(/\}$/, '')
    for (const m of inner.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      vars[`--${m[1]}`] = m[2].trim()
    }
  }

  if (Object.keys(vars).length === 0) return css

  // Replace var(--name) and var(--name, fallback) — up to 3 passes to handle nested vars
  let resolved = css
  for (let pass = 0; pass < 3; pass++) {
    resolved = resolved.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/g,
      (m, name, fallback) => vars[name] || fallback || m
    )
  }
  return resolved
}

// Remove "initial" and "unset" values from inline style attributes
// (produced by juice when shorthand properties are expanded)
function cleanInlineStyles(html) {
  return html
    .replace(/style="([^"]*)"/g, (m, styleVal) => {
      const cleaned = styleVal
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          if (!s) return false
          const val = s.split(':').slice(1).join(':').trim().toLowerCase()
          return val !== 'initial' && val !== 'unset' && val !== ''
        })
        .join('; ')
      return cleaned ? `style="${cleaned}"` : ''
    })
    .replace(/\s+>/g, '>')
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

    // Step 1: Rewrite all relative asset paths to absolute GitHub raw URLs
    let html = rewritePaths(content, rawBase, fileDir)

    // Step 2: Separate external CDN links (Google Fonts, etc.) from local CSS
    const cdnLinkTags = []
    const localCssChunks = []

    // Process <link> tags (order-independent attribute matching)
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
            const cssRelPath = isRepoRaw ? href.replace(rawBase, '') : href
            const cssFilePath = normalizePath(fileDir, cssRelPath)
            const cssContent = await fetchRepoText(cssFilePath)
            if (cssContent) {
              const cssDir = cssFilePath.includes('/')
                ? cssFilePath.substring(0, cssFilePath.lastIndexOf('/') + 1) : ''
              localCssChunks.push(rewritePaths(cssContent, rawBase, cssDir))
            }
            // Remove the local <link> tag from HTML
            parts.push(html.slice(lastIndex, m.index))
            lastIndex = m.index + tag.length
          } else {
            // CDN/Google Fonts — keep in HTML but save separately for re-injection
            cdnLinkTags.push(tag)
          }
        }
      }
      parts.push(html.slice(lastIndex))
      return parts.join('')
    })()

    // Step 3: Extract <style> blocks from HTML
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
      localCssChunks.push(rewritePaths(css, rawBase, fileDir))
      return ''
    })

    // Step 4: Combine all local CSS and resolve CSS custom properties (variables)
    const combinedCss = resolveCssVars(localCssChunks.join('\n\n'))

    // Step 5: Use juice to convert class-based CSS to inline styles
    // so GrapeJS style panel can read and display the actual values
    let finalHtml = html
    if (combinedCss.trim()) {
      try {
        const htmlForJuice = `<style>${combinedCss}</style>${html}`
        const juiced = juice(htmlForJuice, {
          preserveMediaQueries: true,
          preserveFontFaces: true,
          applyWidthAttributes: false,
          applyHeightAttributes: false,
          inlinePseudoElements: false,
        })
        // Clean up "initial"/"unset" noise produced by juice expanding shorthands
        finalHtml = cleanInlineStyles(juiced)
      } catch {
        // juice failed — fall back to embedding CSS as <style> block
        finalHtml = `<style>\n${combinedCss}\n</style>\n${html}`
      }
    }

    // Step 6: Re-inject CDN links (Google Fonts) at the top of <head> or body
    const cdnBlock = cdnLinkTags.join('\n')
    if (cdnBlock) {
      if (finalHtml.includes('</head>')) {
        finalHtml = finalHtml.replace('</head>', `${cdnBlock}\n</head>`)
      } else {
        finalHtml = `${cdnBlock}\n${finalHtml}`
      }
    }

    return NextResponse.json({ html: finalHtml, path: filePath })
  }

  return NextResponse.json({
    error: `Arquivo HTML não encontrado no repositório "${repo}". Certifique-se que existe um arquivo index.html.`
  }, { status: 404 })
}
