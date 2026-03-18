import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

export async function GET(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params

  const { data, error } = await auth.client
    .from('site_versions')
    .select('id, saved_at')
    .eq('site_id', siteId)
    .order('saved_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const { html, css, gjson } = await request.json()

  // Save version
  const { error: vErr } = await auth.client
    .from('site_versions')
    .insert({ site_id: siteId, html, css, gjson })

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // Keep only last 10 versions — delete older ones
  const { data: versions } = await auth.client
    .from('site_versions')
    .select('id, saved_at')
    .eq('site_id', siteId)
    .order('saved_at', { ascending: false })

  if (versions && versions.length > 10) {
    const toDelete = versions.slice(10).map(v => v.id)
    await auth.client.from('site_versions').delete().in('id', toDelete)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const { searchParams } = new URL(request.url)
  const versionId = searchParams.get('versionId')

  if (!versionId) return NextResponse.json({ error: 'versionId obrigatório' }, { status: 400 })

  // Get version data to restore
  const { data: version } = await auth.client
    .from('site_versions')
    .select('html, css, gjson')
    .eq('id', versionId)
    .eq('site_id', siteId)
    .single()

  if (!version) return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })

  return NextResponse.json(version)
}
