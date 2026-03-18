import { supabase } from './supabase'

/**
 * Wrapper de fetch que inclui automaticamente o token de autenticação
 * do Supabase no header Authorization.
 */
export async function authFetch(url, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
