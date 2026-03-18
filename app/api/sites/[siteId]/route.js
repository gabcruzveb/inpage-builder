import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { createServiceClient } from '@/lib/supabase'

async function getSiteForUser(siteId, userId, isAdmin) {
  const service = createServiceClient()
  let query = service.from('sites').select('*').eq('id', siteId)
  if (!isAdmin) query = query.eq('owner_id', userId)
  const { data, error } = await query.single()
  return { data, error }
}

export async function GET(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const isAdmin = auth.profile?.role === 'admin'

  const { data, error } = await getSiteForUser(siteId, auth.user.id, isAdmin)
  if (error || !data) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PUT(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const isAdmin = auth.profile?.role === 'admin'

  const { data: existing } = await getSiteForUser(siteId, auth.user.id, isAdmin)
  if (!existing) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  const body = await request.json()
  const ALLOWED = ['name', 'html', 'css', 'gjson', 'github_repo', 'github_path', 'github_branch']
  const updates = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('sites')
    .update(updates)
    .eq('id', siteId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const isAdmin = auth.profile?.role === 'admin'

  const { data: existing } = await getSiteForUser(siteId, auth.user.id, isAdmin)
  if (!existing) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  const service = createServiceClient()
  const { error } = await service.from('sites').delete().eq('id', siteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
