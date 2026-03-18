import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request, { params }) {
  const { slug } = await params

  const { data: site } = await supabase
    .from('sites')
    .select('name, html, css')
    .eq('slug', slug)
    .single()

  if (!site) {
    return new Response(
      `<!DOCTYPE html><html><head><title>Site não encontrado</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#000;color:#fff">
        <div style="text-align:center">
          <h1 style="color:#E8922A">404</h1>
          <p>Site não encontrado</p>
        </div>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${site.name}</title>
  <style>${site.css || ''}</style>
</head>
<body>
${site.html || '<p style="font-family:sans-serif;padding:2rem;color:#666">Este site ainda não tem conteúdo. Abra o editor para começar.</p>'}
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
