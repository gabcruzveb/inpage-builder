import { NextResponse } from 'next/server'
import { getServerUser, getAdminClient } from '@/lib/auth-server'

export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const isAdmin = auth.profile?.role === 'admin'

  // Admin uses service client (sees all); regular users use their own client (RLS filters by owner_id)
  let data, error
  if (isAdmin) {
    const admin = getAdminClient(auth)
    const result = await admin.from('sites').select('*').order('created_at', { ascending: false })
    data = result.data
    error = result.error
  } else {
    const result = await auth.client
      .from('sites')
      .select('*')
      .eq('owner_id', auth.user.id)
      .order('created_at', { ascending: false })
    data = result.data
    error = result.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { name, slug, owner_id } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'Nome e slug são obrigatórios' }, { status: 400 })
  }

  const finalOwnerId = auth.profile?.role === 'admin' && owner_id ? owner_id : auth.user.id

  const admin = getAdminClient(auth)
  const { data, error } = await admin
    .from('sites')
    .insert({ name, slug, owner_id: finalOwnerId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este slug já está em uso' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
