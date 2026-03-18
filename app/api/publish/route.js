import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { createServiceClient } from '@/lib/supabase'
import { publishToGitHub } from '@/lib/github'

export async function POST(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await request.json()
  if (!siteId) return NextResponse.json({ error: 'siteId é obrigatório' }, { status: 400 })

  const service = createServiceClient()
  const isAdmin = auth.profile?.role === 'admin'

  let query = service.from('sites').select('*').eq('id', siteId)
  if (!isAdmin) query = query.eq('owner_id', auth.user.id)
  const { data: site, error: fetchError } = await query.single()

  if (fetchError || !site) {
    return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
  }

  if (!site.github_repo || !site.github_path) {
    return NextResponse.json(
      { error: 'Configure o repositório GitHub nas configurações do editor primeiro' },
      { status: 400 }
    )
  }

  if (!site.html) {
    return NextResponse.json(
      { error: 'O site não tem conteúdo para publicar. Edite-o no editor primeiro.' },
      { status: 400 }
    )
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN não configurado no servidor' }, { status: 500 })
  }

  const [owner, repo] = site.github_repo.split('/')

  // Monta o HTML completo para publicar
  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${site.name}</title>
  <style>
    ${site.css || ''}
  </style>
</head>
<body>
  ${site.html}
</body>
</html>`

  try {
    await publishToGitHub({
      token,
      owner,
      repo,
      path: site.github_path,
      content: fullHtml,
      message: `Update ${site.name} via Page Builder`,
      branch: site.github_branch || 'main',
    })

    await service
      .from('sites')
      .update({ published_at: new Date().toISOString() })
      .eq('id', siteId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao publicar no GitHub: ' + err.message },
      { status: 500 }
    )
  }
}
