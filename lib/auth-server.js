import { createAuthenticatedClient, createServiceClient } from './supabase'

/**
 * Extrai o usuário autenticado a partir do header Authorization.
 * Retorna { user, profile } ou null.
 */
export async function getServerUser(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const accessToken = authHeader.slice(7)
    if (!accessToken) return null

    const client = createAuthenticatedClient(accessToken)
    const {
      data: { user },
      error,
    } = await client.auth.getUser()

    if (error || !user) return null

    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()

    return { user, profile: profile || { role: 'client' } }
  } catch {
    return null
  }
}
