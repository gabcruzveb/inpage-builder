import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const service = createServiceClient()
  let query = service.from('sites').select('*').order('created_at', { ascending: false })

  if (auth.profile?.role !== 'admin') {
    query = query.eq('owner_id', auth.user.id)
  }

  const { data, error } = await query
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

  // Admin pode definir owner; cliente usa o próprio ID
  const finalOwnerId = auth.profile?.role === 'admin' && owner_id ? owner_id : auth.user.id

  const service = createServiceClient()
  const { data, error } = await service
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
