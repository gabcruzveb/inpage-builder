'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api'

function StatCard({ label, value, color }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <p className="text-zinc-400 text-sm mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color: color || '#E8922A' }}>
        {value}
      </p>
    </div>
  )
}

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const [showCreateSite, setShowCreateSite] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', owner_id: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: profilesData }, { data: sitesData }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('sites').select('*, profiles(email, full_name)').order('created_at', { ascending: false }),
      ])
      setUsers(profilesData || [])
      setSites(sitesData || [])
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCreateSite(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug,
          owner_id: createForm.owner_id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar site')

      setSuccess(`Site "${createForm.name}" criado com sucesso!`)
      setCreateForm({ name: '', slug: '', owner_id: '' })
      setShowCreateSite(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteSite(siteId, siteName) {
    if (!confirm(`Tem certeza que deseja excluir o site "${siteName}"?`)) return

    try {
      const res = await authFetch(`/api/sites/${siteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir site')
      }
      setSuccess(`Site excluído com sucesso.`)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'client' : 'admin'
    if (!confirm(`Alterar papel de "${currentRole}" para "${newRole}"?`)) return

    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao alterar papel')
      }

      setSuccess(`Papel alterado para "${newRole}" com sucesso.`)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#E8922A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-zinc-400 mt-1">Gerencie usuários e sites da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total de usuários" value={users.length} />
        <StatCard label="Total de sites" value={sites.length} color="#60a5fa" />
        <StatCard
          label="Admins"
          value={users.filter((u) => u.role === 'admin').length}
          color="#f87171"
        />
        <StatCard
          label="Sites publicados"
          value={sites.filter((s) => s.published_at).length}
          color="#4ade80"
        />
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-100">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 text-green-300 hover:text-green-100">×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-6 w-fit">
        {['users', 'sites'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'text-black'
                : 'text-zinc-400 hover:text-white'
            }`}
            style={activeTab === tab ? { background: '#E8922A' } : {}}
          >
            {tab === 'users' ? 'Usuários' : 'Sites'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Usuários</h2>
            <span className="text-zinc-400 text-sm">{users.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">
                    E-mail
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">
                    Nome
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">
                    Papel
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">
                    Desde
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 text-white text-sm">{user.email}</td>
                    <td className="px-6 py-4 text-zinc-300 text-sm">
                      {user.full_name || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleRole(user.id, user.role)}
                        className="text-xs text-zinc-400 hover:text-[#E8922A] border border-zinc-700 hover:border-[#E8922A] px-3 py-1 rounded-lg transition-colors"
                      >
                        {user.role === 'admin' ? 'Tornar cliente' : 'Tornar admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sites Tab */}
      {activeTab === 'sites' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Sites</h2>
            <button
              onClick={() => setShowCreateSite(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-black text-sm font-medium transition-all hover:opacity-90"
              style={{ background: '#E8922A' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Criar site
            </button>
          </div>

          {/* Create site modal */}
          {showCreateSite && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-white font-semibold text-lg mb-6">Criar novo site</h3>
                <form onSubmit={handleCreateSite} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Proprietário</label>
                    <select
                      value={createForm.owner_id}
                      onChange={(e) => setCreateForm({ ...createForm, owner_id: e.target.value })}
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-[#E8922A] focus:outline-none"
                    >
                      <option value="">Selecione um usuário</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} {u.full_name ? `(${u.full_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Nome do site</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          name: e.target.value,
                          slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                        })
                      }
                      required
                      placeholder="Meu Site Incrível"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-[#E8922A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Slug (URL)</label>
                    <input
                      type="text"
                      value={createForm.slug}
                      onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                      required
                      placeholder="meu-site-incrivel"
                      pattern="[a-z0-9-]+"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-[#E8922A] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCreateSite(false)}
                      className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 py-3 rounded-xl text-black text-sm font-medium transition-all disabled:opacity-60"
                      style={{ background: '#E8922A' }}
                    >
                      {creating ? 'Criando...' : 'Criar site'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">Nome</th>
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">Slug</th>
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">Proprietário</th>
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">GitHub</th>
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">Publicado</th>
                    <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sites.map((site) => (
                    <tr key={site.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 text-white text-sm font-medium">{site.name}</td>
                      <td className="px-6 py-4 text-zinc-400 text-sm font-mono">{site.slug}</td>
                      <td className="px-6 py-4 text-zinc-300 text-sm">
                        {site.profiles?.email || <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-6 py-4 text-zinc-400 text-sm">
                        {site.github_repo ? (
                          <a
                            href={`https://github.com/${site.github_repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#E8922A] hover:underline"
                          >
                            {site.github_repo}
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {site.published_at ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Publicado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-zinc-700/50 text-zinc-400 border border-zinc-700">
                            Rascunho
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/editor/${site.id}`}
                            className="text-xs text-zinc-400 hover:text-[#E8922A] border border-zinc-700 hover:border-[#E8922A] px-3 py-1 rounded-lg transition-colors"
                          >
                            Editar
                          </a>
                          <button
                            onClick={() => handleDeleteSite(site.id, site.name)}
                            className="text-xs text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 px-3 py-1 rounded-lg transition-colors"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sites.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                        Nenhum site criado ainda
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
