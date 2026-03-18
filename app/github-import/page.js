'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api'
import { Suspense } from 'react'

function GitHubImportContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [githubUser, setGithubUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(null)
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [branchInput, setBranchInput] = useState('main')
  const [siteName, setSiteName] = useState('')
  const [creating, setCreating] = useState(false)

  // Handle OAuth callback — save token from cookie
  const saveTokenFromCallback = useCallback(async () => {
    const ghToken = getCookie('gh_pending_token')
    const ghUser = getCookie('gh_pending_user')

    if (ghToken) {
      // Save to profile
      await authFetch('/api/github/connect', {
        method: 'POST',
        body: JSON.stringify({ github_token: ghToken, github_username: ghUser }),
      })
      // Clear cookies
      deleteCookie('gh_pending_token')
      deleteCookie('gh_pending_user')
      return { token: ghToken, user: ghUser }
    }
    return null
  }, [])

  // Load GitHub profile
  const loadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    await saveTokenFromCallback()

    // Check if GitHub is connected
    const res = await authFetch('/api/github/repos')
    if (res.ok) {
      const d = await res.json()
      setGithubUser(d.username)
      setRepos(d.repos || [])
    } else {
      setGithubUser(null)
    }
    setLoading(false)
  }, [router, saveTokenFromCallback])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function loadRepos() {
    setLoadingRepos(true)
    const res = await authFetch('/api/github/repos')
    if (res.ok) {
      const d = await res.json()
      setRepos(d.repos || [])
    }
    setLoadingRepos(false)
  }

  // Import repo: create site + load HTML
  async function handleImport() {
    if (!selectedRepo || !siteName.trim()) return
    setCreating(true)
    setError('')
    try {
      // 1. Create site
      const slug = siteName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'site'
      const createRes = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({ name: siteName, slug }),
      })
      const siteData = await createRes.json()
      if (!createRes.ok) throw new Error(siteData.error)
      const siteId = siteData.id

      // 2. Save GitHub settings to site
      await authFetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({
          github_repo: selectedRepo.full_name,
          github_path: 'index.html',
          github_branch: branchInput || selectedRepo.default_branch,
        }),
      })

      // 3. Fetch HTML from GitHub
      const fileRes = await authFetch(
        `/api/github/file?repo=${encodeURIComponent(selectedRepo.full_name)}&branch=${branchInput || selectedRepo.default_branch}&path=index.html`
      )
      if (fileRes.ok) {
        const fileData = await fileRes.json()
        // Save HTML + CSS separately so GrapeJS style panel detects all properties
        await authFetch(`/api/sites/${siteId}`, {
          method: 'PUT',
          body: JSON.stringify({ html: fileData.html, css: fileData.css || '' }),
        })
      }

      // 4. Go to editor
      router.push(`/editor/${siteId}`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000' }}>
      <div style={{ width:32,height:32,border:'2px solid #E8922A',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh',background:'#000',fontFamily:'sans-serif',padding:'40px 20px' }}>
      <div style={{ maxWidth:800,margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:32 }}>
          <a href="/dashboard" style={{ color:'#888',textDecoration:'none',fontSize:14 }}>← Dashboard</a>
          <h1 style={{ color:'#fff',fontSize:28,fontWeight:800,margin:0 }}>Importar do GitHub</h1>
        </div>

        {/* Not connected */}
        {!githubUser ? (
          <div style={{ textAlign:'center',padding:'60px 20px',background:'#111',borderRadius:16,border:'1px solid #222' }}>
            <div style={{ fontSize:48,marginBottom:16 }}>🐙</div>
            <h2 style={{ color:'#fff',fontSize:22,fontWeight:700,margin:'0 0 12px' }}>Conecte sua conta do GitHub</h2>
            <p style={{ color:'#666',fontSize:15,margin:'0 0 28px',maxWidth:480,marginLeft:'auto',marginRight:'auto' }}>
              Autorize o acesso para listar seus repositórios, puxar o HTML do site e publicar de volta automaticamente.
            </p>
            <a
              href="/api/auth/github?returnTo=/github-import"
              style={{ display:'inline-block',background:'#fff',color:'#000',padding:'14px 32px',borderRadius:10,fontWeight:700,textDecoration:'none',fontSize:15 }}
            >
              🐙 Conectar com GitHub
            </a>
          </div>
        ) : (
          <>
            {/* Connected badge */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'#0d1117',border:'1px solid #238636',borderRadius:10,marginBottom:24 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ color:'#3fb950',fontSize:13 }}>✓ Conectado como</span>
                <span style={{ color:'#fff',fontWeight:700,fontSize:13 }}>@{githubUser}</span>
              </div>
              <button
                onClick={async () => {
                  await authFetch('/api/github/connect', { method: 'DELETE' })
                  setGithubUser(null); setRepos([])
                }}
                style={{ color:'#666',background:'none',border:'1px solid #333',borderRadius:7,padding:'5px 12px',cursor:'pointer',fontSize:12 }}
              >
                Desconectar
              </button>
            </div>

            {/* Repo selection */}
            {!selectedRepo ? (
              <>
                <div style={{ display:'flex',gap:10,marginBottom:16 }}>
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar repositório..."
                    style={{ flex:1,background:'#111',border:'1px solid #2a2a2a',borderRadius:9,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none' }}
                  />
                  <button onClick={loadRepos} disabled={loadingRepos}
                    style={{ padding:'10px 16px',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:9,color:'#aaa',cursor:'pointer',fontSize:13 }}>
                    {loadingRepos ? '⟳' : '↻ Atualizar'}
                  </button>
                </div>

                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {filteredRepos.map(repo => (
                    <div key={repo.id}
                      onClick={() => { setSelectedRepo(repo); setSiteName(repo.name); setBranchInput(repo.default_branch) }}
                      style={{ padding:'14px 16px',background:'#111',border:'1px solid #222',borderRadius:10,cursor:'pointer',transition:'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#E8922A'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#222'}
                    >
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                        <div>
                          <div style={{ color:'#fff',fontWeight:600,fontSize:14 }}>
                            {repo.private ? '🔒 ' : '📂 '}{repo.full_name}
                          </div>
                          {repo.description && (
                            <div style={{ color:'#666',fontSize:12,marginTop:3 }}>{repo.description}</div>
                          )}
                        </div>
                        <div style={{ color:'#555',fontSize:11 }}>
                          {repo.default_branch} • {new Date(repo.updated_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredRepos.length === 0 && (
                    <div style={{ textAlign:'center',padding:'32px',color:'#555' }}>Nenhum repositório encontrado.</div>
                  )}
                </div>
              </>
            ) : (
              /* Import config */
              <div style={{ background:'#111',border:'1px solid #2a2a2a',borderRadius:14,padding:28 }}>
                <button onClick={() => setSelectedRepo(null)} style={{ color:'#888',background:'none',border:'none',cursor:'pointer',fontSize:13,marginBottom:16 }}>← Voltar para lista</button>

                <h3 style={{ color:'#fff',fontSize:18,fontWeight:700,margin:'0 0 4px' }}>
                  📂 {selectedRepo.full_name}
                </h3>
                <p style={{ color:'#666',fontSize:13,margin:'0 0 24px' }}>Configure como este repositório será importado.</p>

                <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                  <div>
                    <label style={{ display:'block',color:'#ccc',fontSize:13,marginBottom:5 }}>Nome do site <span style={{ color:'#555' }}>(como vai aparecer no dashboard)</span></label>
                    <input value={siteName} onChange={e => setSiteName(e.target.value)}
                      placeholder="Ex: Site do João"
                      style={{ width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:9,padding:'10px 13px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box' }} />
                    {siteName && <p style={{ color:'#E8922A',fontSize:12,marginTop:4 }}>URL: /s/{siteName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}</p>}
                  </div>

                  <div>
                    <label style={{ display:'block',color:'#ccc',fontSize:13,marginBottom:5 }}>Branch <span style={{ color:'#555' }}>(qual branch usar)</span></label>
                    <input value={branchInput} onChange={e => setBranchInput(e.target.value)}
                      placeholder={selectedRepo.default_branch}
                      style={{ width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:9,padding:'10px 13px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box' }} />
                  </div>

                  {error && (
                    <div style={{ padding:'12px 14px',background:'#450a0a',border:'1px solid #7f1d1d',borderRadius:9,color:'#fca5a5',fontSize:13 }}>
                      {error}
                    </div>
                  )}

                  <div style={{ background:'#0d1117',border:'1px solid #30363d',borderRadius:9,padding:14 }}>
                    <p style={{ color:'#888',fontSize:12,margin:0,lineHeight:1.6 }}>
                      ℹ️ O sistema vai buscar o arquivo <code style={{ color:'#E8922A' }}>index.html</code> do repositório e abrir no editor.<br />
                      <strong style={{ color:'#aaa' }}>Importante:</strong> funciona melhor com sites HTML estáticos. Sites Next.js/React precisam ser exportados como HTML antes.
                    </p>
                  </div>

                  <button onClick={handleImport} disabled={creating || !siteName.trim()}
                    style={{ width:'100%',padding:'14px',background:creating||!siteName.trim()?'#333':'linear-gradient(135deg,#E8922A,#c77a1e)',color:creating||!siteName.trim()?'#666':'#000',borderRadius:9,border:'none',fontWeight:700,fontSize:15,cursor:creating||!siteName.trim()?'not-allowed':'pointer' }}>
                    {creating ? '⟳ Importando e abrindo editor…' : '🚀 Importar e Abrir Editor'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Cookie helpers
function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}
function deleteCookie(name) {
  document.cookie = `${name}=; max-age=0; path=/`
}

export default function GitHubImportPage() {
  return (
    <Suspense fallback={<div style={{ background:'#000',height:'100vh' }} />}>
      <GitHubImportContent />
    </Suspense>
  )
}
