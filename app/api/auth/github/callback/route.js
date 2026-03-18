import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Step 2: GitHub redirects here with a code — exchange for access token
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!code) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_auth_failed`)
  }

  let state = { siteId: '', returnTo: '/dashboard' }
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch { /* use defaults */ }

  // Exchange code for GitHub access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const tokenData = await tokenRes.json()

  if (tokenData.error || !tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=github_token_failed`)
  }

  const githubToken = tokenData.access_token

  // Get GitHub username
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'InPage-Builder' },
  })
  const githubUser = await userRes.json()

  // We store the token in a cookie so the client can save it to their profile
  // The actual saving happens client-side via the /api/github/connect endpoint
  const redirectUrl = new URL(`${appUrl}${state.returnTo || '/dashboard'}`)
  redirectUrl.searchParams.set('gh_token', githubToken)
  redirectUrl.searchParams.set('gh_user', githubUser.login || '')
  if (state.siteId) redirectUrl.searchParams.set('siteId', state.siteId)

  const response = NextResponse.redirect(redirectUrl.toString())

  // Short-lived cookie to transfer token to client securely
  response.cookies.set('gh_pending_token', githubToken, {
    httpOnly: false,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
  })
  response.cookies.set('gh_pending_user', githubUser.login || '', {
    httpOnly: false,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
  })

  return response
}
