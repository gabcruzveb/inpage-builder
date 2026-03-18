'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api'

function SiteCard({ site, onPublish, onDelete, publishing }) {
  const hasGithub = site.github_repo && site.github_path

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all group">
      {/* Card header / preview area */}
      <div
        className="h-40 flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1a1a, #111)' }}
      >
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(232,146,42,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(232,146,42,0.3) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2"
            style={{ background: 'rgba(232,146,42,0.15)', border: '1px solid rgba(232,146,42,0.3)' }}
          >
            <svg className="w-6 h-6" style={{ color: '#E8922A' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <span className="text-zinc-500 text-xs">{site.slug}</span>
        </div>

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {site.published_at ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Publicado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-700/80 text-zinc-400 border border-zinc-600">
              Rascunho
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-5">
        <h3 className="text-white font-semibold text-lg mb-1 truncate">{site.name}</h3>

        {hasGithub ? (
          <a
            href={`https://github.com/${site.github_repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-[#E8922A] transition-colors flex items-center gap-1 mb-4 truncate"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            {site.github_repo}
          </a>
        ) : (
          <p className="text-xs text-zinc-600 mb-4">GitHub não configurado</p>
        )}

        {site.updated_at && (
          <p className="text-xs text-zinc-600 mb-4">
            Atualizado {new Date(site.updated_at).toLocaleDateString('pt-BR')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={`/editor/${site.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-black text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #E8922A, #c77a1e)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </a>
          <button
            onClick={() => onPublish(site)}
            disabled={publishing === site.id || !hasGithub}
            title={!hasGithub ? 'Configure o GitHub no editor primeiro' : 'Publicar no GitHub'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: hasGithub ? '#E8922A' : '#444',
              color: hasGithub ? '#E8922A' : '#666',
            }}
          >
            {publishing === site.id ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Publicando
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Publicar
              </>
            )}
          </button>
          <button
            onClick={() => onDelete(site)}
            className="p-2.5 rounded-xl border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/50 transition-all"
            title="Excluir site"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSites = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setSites(data || [])
    } catch (err) {
      setError('Erro ao carregar sites: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  async function handleCreateSite(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({ name: createForm.name, slug: createForm.slug }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar site')

      setSuccess(`Site "${createForm.name}" criado com sucesso!`)
      setCreateForm({ name: '', slug: '' })
      setShowCreate(false)
      fetchSites()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handlePublish(site) {
    setPublishing(site.id)
    setError('')
    setSuccess('')

    try {
      const res = await authFetch('/api/publish', {
        method: 'POST',
        body: JSON.stringify({ siteId: site.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao publicar')

      setSuccess(`Site "${site.name}" publicado com sucesso no GitHub!`)
      fetchSites()
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(null)
    }
  }

  async function handleDelete(site) {
    if (!confirm(`Tem certeza que deseja excluir o site "${site.name}"? Esta ação não pode ser desfeita.`)) return

    try {
      const res = await authFetch(`/api/sites/${site.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      setSuccess(`Site "${site.name}" excluído.`)
      fetchSites()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Meus Sites</h1>
          <p className="text-zinc-400 mt-1">
            {loading ? 'Carregando...' : `${sites.length} site${sites.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-black font-semibold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #E8922A, #c77a1e)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo site
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start justify-between gap-4">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-red-100 flex-shrink-0">×</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-start justify-between gap-4">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-300 hover:text-green-100 flex-shrink-0">×</button>
        </div>
      )}

      {/* Create Site Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-semibold text-xl mb-6">Criar novo site</h2>
            <form onSubmit={handleCreateSite} className="space-y-4">
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
                <label className="block text-sm text-zinc-300 mb-2">
                  Slug <span className="text-zinc-500">(URL amigável)</span>
                </label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  required
                  placeholder="meu-site-incrivel"
                  pattern="[a-z0-9-]+"
                  title="Apenas letras minúsculas, números e hífens"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-[#E8922A] focus:outline-none font-mono"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Apenas letras minúsculas, números e hífens
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateForm({ name: '', slug: '' }) }}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl text-black text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: '#E8922A' }}
                >
                  {creating ? 'Criando...' : 'Criar site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#E8922A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24 px-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(232,146,42,0.1)', border: '1px solid rgba(232,146,42,0.2)' }}
          >
            <svg className="w-10 h-10" style={{ color: '#E8922A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Nenhum site ainda</h3>
          <p className="text-zinc-400 mb-8 max-w-sm mx-auto">
            Crie seu primeiro site e comece a construir páginas incríveis com nosso editor drag-and-drop.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-black font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #E8922A, #c77a1e)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Criar meu primeiro site
          </button>
        </div>
      ) : (
        /* Sites Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onPublish={handlePublish}
              onDelete={handleDelete}
              publishing={publishing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
