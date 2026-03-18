import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth-server'

// Save GitHub token to user's profile
export async function POST(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { github_token, github_username } = await request.json()
  if (!github_token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const { error } = await auth.client
    .from('profiles')
    .update({ github_token, github_username })
    .eq('id', auth.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Disconnect GitHub
export async function DELETE(request) {
  const auth = await getServerUser(request)
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await auth.client
    .from('profiles')
    .update({ github_token: null, github_username: null })
    .eq('id', auth.user.id)

  return NextResponse.json({ ok: true })
}
