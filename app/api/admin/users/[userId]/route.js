import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(request, { params }) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (auth.profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { userId } = await params
  const { role } = await request.json()

  if (!role || !['admin', 'client'].includes(role)) {
    return NextResponse.json({ error: 'Papel inválido. Use "admin" ou "client".' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
