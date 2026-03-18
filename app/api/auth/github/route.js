import { NextResponse } from 'next/server'

// Step 1: Redirect user to GitHub OAuth authorization page
export async function GET(request) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID não configurado' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('siteId') || ''
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  // state encodes where to redirect after auth
  const state = Buffer.from(JSON.stringify({ siteId, returnTo })).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'repo read:user',
    state,
    allow_signup: 'false',
  })

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  )
}
