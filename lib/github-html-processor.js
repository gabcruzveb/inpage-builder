// Shared HTML/CSS processing pipeline for GitHub imports
// Used by: /api/github/file and /api/sites/[siteId]/pull-github

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
    /url\(\s*['"]?(?!https?:\/\/|\/\/|data:|#)(\.\/)?([^'")\s]+)['"]?\s*\)/g,
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
  const rootBlocks = css.match(/(?::root|html)\s*\{([^}]*)\}/g) || []
  for (const block of rootBlocks) {
    const inner = block.replace(/(?::root|html)\s*\{/, '').replace(/\}$/, '')
    for (const m of inner.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      vars[`--${m[1]}`] = m[2].trim()
    }
  }
  if (Object.keys(vars).length === 0) return css
  let resolved = css
  for (let pass = 0; pass < 3; pass++) {
    resolved = resolved.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/g,
      (m, name, fallback) => vars[name] || fallback || m
    )
  }
  return resolved
}

/**
 * Process raw HTML from a GitHub repository:
 * 1. Rewrite relative asset paths to absolute GitHub raw URLs
 * 2. Fetch and embed linked local CSS files
 * 3. Extract inline <style> blocks
 * 4. Resolve CSS custom properties (variables)
 * 5. Re-embed combined CSS as a single <style> block in <head>
 * 6. Re-inject CDN links (Google Fonts, etc.) in <head>
 *
 * Returns the processed HTML string with all CSS embedded.
 * CSS stays as a <style> block (NOT inlined) so media queries and
 * responsive layouts are fully preserved.
 */
export async function processGithubHtml({ content, rawBase, apiBase, ghHeaders, branch, filePath }) {
  const fileDir = filePath.includes('/')
    ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : ''

  async function fetchRepoText(fp) {
    const clean = fp.replace(/^\//, '')
    const res = await fetch(`${apiBase}${clean}?ref=${branch}`, { headers: ghHeaders })
    if (!res.ok) return null
    const data = await res.json()
    return data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null
  }

  // Step 1: Rewrite all relative asset paths to absolute GitHub raw URLs
  let html = rewritePaths(content, rawBase, fileDir)

  // Step 2: Separate CDN links (Google Fonts, etc.) from local CSS
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
          // CDN/Google Fonts — keep separately for re-injection
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

  // Step 5: Embed combined CSS as a <style> block in <head>
  // We intentionally do NOT inline CSS (no juice) so that:
  // - @media queries are preserved and responsive layouts work correctly
  // - Desktop overrides can properly override mobile-first base styles
  let finalHtml = html
  if (combinedCss.trim()) {
    const styleBlock = `<style>\n${combinedCss}\n</style>`
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${styleBlock}\n</head>`)
    } else if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>', `<head>\n${styleBlock}`)
    } else {
      finalHtml = `${styleBlock}\n${finalHtml}`
    }
  }

  // Step 6: Re-inject CDN links (Google Fonts) at the top of <head>
  const cdnBlock = cdnLinkTags.join('\n')
  if (cdnBlock) {
    if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>', `<head>\n${cdnBlock}`)
    } else if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${cdnBlock}\n</head>`)
    } else {
      finalHtml = `${cdnBlock}\n${finalHtml}`
    }
  }

  return finalHtml
}
