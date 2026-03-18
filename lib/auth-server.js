import { createAuthenticatedClient, createServiceClient } from './supabase'

/**
 * Extrai o usuário autenticado a partir do header Authorization.
 * Retorna { user, profile, client, accessToken } ou null.
 */
export async function getServerUser(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const accessToken = authHeader.slice(7)
    if (!accessToken) return null

    const client = createAuthenticatedClient(accessToken)
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return null

    // Try to get profile with service role; fall back to authenticated client
    let profile = { role: 'client' }
    try {
      const service = createServiceClient()
      const { data } = await service
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', user.id)
        .single()
      if (data) profile = data
    } catch {
      // Service role key not available — use authenticated client
      const { data } = await client
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', user.id)
        .single()
      if (data) profile = data
    }

    return { user, profile, client, accessToken }
  } catch {
    return null
  }
}

/**
 * Returns a service client if key is available, otherwise falls back to user's client.
 */
export function getAdminClient(auth) {
  try {
    return createServiceClient()
  } catch {
    return auth.client
  }
}
