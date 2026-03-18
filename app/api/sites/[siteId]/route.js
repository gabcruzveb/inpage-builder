import { NextResponse } from 'next/server'
import { getServerUser, getAdminClient } from '@/lib/auth-server'

export async function GET(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const isAdmin = auth.profile?.role === 'admin'

  const queryClient = isAdmin ? getAdminClient(auth) : auth.client
  let query = queryClient.from('sites').select('*').eq('id', siteId)
  if (!isAdmin) query = query.eq('owner_id', auth.user.id)

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PUT(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { siteId } = await params
  const isAdmin = auth.profile?.role === 'admin'

  // Verify ownership first
  const checkClient = isAdmin ? getAdminClient(auth) : auth.client
  let checkQuery = checkClient.from('sites').select('id').eq('id', siteId)
  if (!isAdmin) checkQuery = checkQuery.eq('owner_id', auth.user.id)
  const { data: existing } = await checkQuery.single()
  if (!existing) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  const body = await request.json()
  const ALLOWED = ['name', 'html', 'css', 'gjson', 'github_repo', 'github_path', 'github_branch']
  const updates = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await auth.client
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

  // Verify ownership first
  const checkClient = isAdmin ? getAdminClient(auth) : auth.client
  let checkQuery = checkClient.from('sites').select('id').eq('id', siteId)
  if (!isAdmin) checkQuery = checkQuery.eq('owner_id', auth.user.id)
  const { data: existing } = await checkQuery.single()
  if (!existing) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })

  const { error } = await auth.client.from('sites').delete().eq('id', siteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
