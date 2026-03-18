import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  // Limpa todos os cookies de sessão do Supabase
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')
  return response
}
