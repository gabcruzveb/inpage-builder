'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { authFetch } from '@/lib/api'
import { EDITOR_BLOCKS } from '@/lib/editor-blocks'

// Blocks defined at module level — never recreated on render
const BLOCKS = EDITOR_BLOCKS

export default function EditorPage() {
  const { siteId } = useParams()

  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const saveTimer = useRef(null)

  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState(null)

  // Panels
  const [panel, setPanel] = useState(null) // null | 'github' | 'history'
  const [ghForm, setGhForm] = useState({ github_repo: '', github_path: 'index.html', github_branch: 'main' })
  const [savingGH, setSavingGH] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState(null)

  function showToast(type, msg, duration = 4000) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), duration)
  }

  // ── Load site ─────────────────────────────────────────────────────────────
  useEffect(() => {
    authFetch(`/api/sites/${siteId}`).then(async (res) => {
      if (!res.ok) { setLoadError('Site não encontrado ou sem permissão.'); setLoading(false); return }
      const d = await res.json()
      setSite(d)
      setGhForm({ github_repo: d.github_repo || '', github_path: d.github_path || 'index.html', github_branch: d.github_branch || 'main' })
      setLoading(false)
    }).catch(() => { setLoadError('Erro ao carregar site.'); setLoading(false) })
  }, [siteId])

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(async (editor) => {
    if (!editor) return
    setSaveStatus('saving')
    try {
      const res = await authFetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({ html: editor.getHtml(), css: editor.getCss(), gjson: editor.getProjectData() }),
      })
      setSaveStatus(res.ok ? 'saved' : 'unsaved')
    } catch { setSaveStatus('unsaved') }
  }, [siteId])

  function scheduleSave(editor) {
    setSaveStatus('unsaved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(editor), 2500)
  }

  // ── Save version snapshot ─────────────────────────────────────────────────
  async function saveVersion(editor) {
    if (!editor) return
    try {
      await authFetch(`/api/sites/${siteId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ html: editor.getHtml(), css: editor.getCss(), gjson: editor.getProjectData() }),
      })
    } catch { /* silent */ }
  }

  // ── Init GrapeJS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !site || !containerRef.current) return
    let editor
    let destroyed = false

    async function init() {
      const [{ default: grapesjs }, { default: presetWebpage }] = await Promise.all([
        import('grapesjs'),
        import('grapesjs-preset-webpage'),
      ])

      if (destroyed) return

      // GrapeJS CSS (load once)
      if (!document.getElementById('gjs-styles')) {
        const link = document.createElement('link')
        link.id = 'gjs-styles'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css'
        document.head.appendChild(link)
      }

      // Custom dark theme CSS (load once)
      if (!document.getElementById('gjs-theme')) {
        const s = document.createElement('style')
        s.id = 'gjs-theme'
        s.textContent = `
          .gjs-pn-panels,.gjs-pn-panel{background:#161616!important;border-color:#222!important}
          .gjs-pn-btn{color:#888!important}
          .gjs-pn-btn:hover,.gjs-pn-btn.gjs-pn-active{color:#E8922A!important}
          .gjs-blocks-c{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px}
          .gjs-block{border-color:#2a2a2a!important;background:#1a1a1a!important;color:#ccc!important;border-radius:8px!important;padding:10px 6px!important;font-size:11px!important}
          .gjs-block:hover{border-color:#E8922A!important;color:#E8922A!important;background:#1e1a14!important}
          .gjs-block-category .gjs-title{background:#1a1a1a!important;color:#E8922A!important;border-color:#2a2a2a!important;font-size:10px;text-transform:uppercase;letter-spacing:1px}
          .gjs-cv-canvas{background:#e5e5e5!important}
          .gjs-toolbar{background:#1a1a1a!important;border-color:#333!important}
          .gjs-toolbar-item{color:#888!important}
          .gjs-toolbar-item:hover{color:#E8922A!important}
          .gjs-selected{outline:2px solid #E8922A!important}
          .gjs-hovered{outline:1px dashed rgba(232,146,42,0.5)!important}
          .gjs-sm-sector-title,.gjs-layer-title{background:#1a1a1a!important;color:#ccc!important;border-color:#2a2a2a!important}
          .gjs-field{background:#1a1a1a!important;border-color:#2a2a2a!important;color:#fff!important}
          .gjs-field:focus{border-color:#E8922A!important}
          .gjs-sm-label,.gjs-trt-header{color:#888!important}
          .gjs-layers,.gjs-trt-traits{background:#111!important}
          .gjs-layer{background:#161616!important;color:#ccc!important;border-color:#222!important}
          .gjs-layer.gjs-selected{background:#1e1a14!important;color:#E8922A!important}
          .gjs-mdl-dialog{background:#111!important;border-color:#2a2a2a!important}
          .gjs-mdl-header{background:#161616!important;color:#fff!important;border-color:#2a2a2a!important}
          .gjs-mdl-content{background:#111!important;color:#ccc!important}
          .gjs-btn-prim{background:#E8922A!important;color:#000!important;border:none!important;font-weight:700!important}
          .gjs-cm-editor-c,.CodeMirror{background:#0d0d0d!important;color:#e0e0e0!important}
        `
        document.head.appendChild(s)
      }

      editor = grapesjs.init({
        container: containerRef.current,
        height: '100%',
        width: 'auto',
        storageManager: false,
        undoManager: { trackSelection: false },
        plugins: [presetWebpage],
        pluginsOpts: {
          [presetWebpage]: {
            modalImportTitle: 'Importar HTML existente',
            modalImportLabel: '<p style="color:#aaa;font-size:13px;margin-bottom:8px">Cole o código HTML do seu site. Use isso para carregar sites já criados no editor.</p>',
            modalImportButton: 'Carregar HTML',
          },
        },
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Tablet', width: '768px', widthMedia: '992px' },
            { name: 'Mobile', width: '375px', widthMedia: '480px' },
          ],
        },
      })

      if (destroyed) { editor.destroy(); return }

      // Register custom blocks (replace preset defaults)
      const bm = editor.BlockManager
      bm.getAll().reset()
      BLOCKS.forEach(({ id, label, category, content }) => {
        bm.add(id, { label, category, content })
      })

      // Load existing content
      if (site.gjson) {
        try {
          editor.loadProjectData(typeof site.gjson === 'string' ? JSON.parse(site.gjson) : site.gjson)
        } catch {
          if (site.html) editor.setComponents(site.html)
          if (site.css) editor.setStyle(site.css)
        }
      } else if (site.html) {
        editor.setComponents(site.html)
        if (site.css) editor.setStyle(site.css)
      }

      editorRef.current = editor

      // Auto-save on changes
      let changeTimer = null
      const onChange = () => {
        setSaveStatus('unsaved')
        clearTimeout(changeTimer)
        changeTimer = setTimeout(() => doSave(editor), 2500)
      }
      editor.on('component:update', onChange)
      editor.on('component:add', onChange)
      editor.on('component:remove', onChange)
      editor.on('style:update', onChange)
    }

    init().catch(err => console.error('GrapeJS init error:', err))

    return () => {
      destroyed = true
      clearTimeout(saveTimer.current)
      if (editorRef.current) {
        try { editorRef.current.destroy() } catch { /* ignore */ }
        editorRef.current = null
      }
    }
  }, [loading, site]) // eslint-disable-line

  // ── Publish to GitHub ─────────────────────────────────────────────────────
  async function handlePublish() {
    const editor = editorRef.current
    if (!editor) return
    setPublishing(true)
    try {
      await doSave(editor)
      await saveVersion(editor)
      const res = await authFetch('/api/publish', { method: 'POST', body: JSON.stringify({ siteId }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      showToast('success', '🚀 Publicado no GitHub! Vercel fará o deploy automaticamente.')
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setPublishing(false)
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  function handlePreview() {
    if (site?.slug) {
      window.open(`/s/${site.slug}`, '_blank')
    } else {
      const ed = editorRef.current
      if (!ed) return
      const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${ed.getCss()}</style></head><body>${ed.getHtml()}</body></html>`], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    }
  }

  // ── Pull from GitHub ──────────────────────────────────────────────────────
  async function handlePullGitHub() {
    if (!site?.github_repo) {
      showToast('error', 'Configure o repositório GitHub primeiro.')
      setPanel('github')
      return
    }
    setPulling(true)
    try {
      const res = await authFetch(`/api/sites/${siteId}/pull-github`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      const ed = editorRef.current
      if (ed) {
        // Save current state as a version before overwriting
        await saveVersion(ed)
        ed.setComponents(d.html)
        showToast('success', '✓ HTML carregado do GitHub! Versão anterior salva no histórico.')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setPulling(false)
    }
  }

  // ── Load versions ─────────────────────────────────────────────────────────
  async function handleOpenHistory() {
    setPanel('history')
    setLoadingVersions(true)
    try {
      const res = await authFetch(`/api/sites/${siteId}/versions`)
      const d = await res.json()
      setVersions(res.ok ? d : [])
    } catch { setVersions([]) }
    finally { setLoadingVersions(false) }
  }

  // ── Restore version ───────────────────────────────────────────────────────
  async function handleRestoreVersion(versionId) {
    setRestoringVersion(versionId)
    try {
      const res = await authFetch(`/api/sites/${siteId}/versions?versionId=${versionId}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      const ed = editorRef.current
      if (ed) {
        if (d.gjson) {
          ed.loadProjectData(typeof d.gjson === 'string' ? JSON.parse(d.gjson) : d.gjson)
        } else {
          ed.setComponents(d.html || '')
          ed.setStyle(d.css || '')
        }
        await doSave(ed)
        showToast('success', '✓ Versão restaurada com sucesso!')
        setPanel(null)
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setRestoringVersion(null)
    }
  }

  // ── Save GitHub settings ──────────────────────────────────────────────────
  async function handleSaveGH(e) {
    e.preventDefault(); setSavingGH(true)
    try {
      const res = await authFetch(`/api/sites/${siteId}`, { method: 'PUT', body: JSON.stringify(ghForm) })
      if (!res.ok) throw new Error((await res.json()).error)
      setSite(p => ({ ...p, ...ghForm }))
      setPanel(null)
      showToast('success', '✓ Configurações do GitHub salvas!')
    } catch (err) { showToast('error', err.message) }
    finally { setSavingGH(false) }
  }

  // ── Import existing HTML ──────────────────────────────────────────────────
  function handleImportHTML() {
    editorRef.current?.runCommand('gjs-open-import-webpage')
  }

  // ── Save + snapshot manually ──────────────────────────────────────────────
  async function handleManualSave() {
    const ed = editorRef.current
    if (!ed) return
    await doSave(ed)
    await saveVersion(ed)
    showToast('success', '✓ Salvo e versão registrada no histórico!')
  }

  // ─── States ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000' }}>
      <div style={{ width:32,height:32,border:'2px solid #E8922A',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (loadError) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000',color:'#fff',gap:16,padding:20,textAlign:'center' }}>
      <p style={{ color:'#f87171',fontSize:16 }}>{loadError}</p>
      <a href="/dashboard" style={{ color:'#E8922A',textDecoration:'underline' }}>← Voltar ao Dashboard</a>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────
  const hasGH = !!(site?.github_repo)

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:'#111',overflow:'hidden' }}>

      {/* ── Top bar ── */}
      <header style={{ height:52,background:'#111',borderBottom:'1px solid #222',display:'flex',alignItems:'center',padding:'0 10px',gap:6,flexShrink:0,zIndex:9999,overflowX:'auto' }}>

        <a href="/dashboard" style={{ display:'flex',alignItems:'center',gap:4,color:'#888',textDecoration:'none',fontSize:12,padding:'5px 9px',borderRadius:7,border:'1px solid #2a2a2a',whiteSpace:'nowrap',flexShrink:0 }}>
          ← Dashboard
        </a>

        <div style={{ width:1,height:22,background:'#2a2a2a',flexShrink:0 }} />

        <span style={{ color:'#fff',fontWeight:600,fontSize:13,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:60 }}>
          {site?.name}
        </span>

        {/* Save status */}
        <span style={{ fontSize:11,color:saveStatus==='saved'?'#4ade80':saveStatus==='saving'?'#E8922A':'#f87171',whiteSpace:'nowrap',flexShrink:0 }}>
          {saveStatus==='saved'?'✓ Salvo':saveStatus==='saving'?'⟳ Salvando':'● Não salvo'}
        </span>

        <div style={{ display:'flex',gap:5,flexShrink:0,alignItems:'center' }}>
          <TopBtn onClick={handleManualSave} label="💾 Salvar" />
          <TopBtn onClick={handlePreview} label="👁 Ver site" />
          <TopBtn onClick={handleImportHTML} label="📋 Colar HTML" title="Carrega HTML de qualquer site no editor" />
          <TopBtn onClick={handlePullGitHub} label={pulling ? '⟳ Buscando…' : '⬇ Do GitHub'} title="Puxa o HTML atual do repositório GitHub" disabled={pulling} />
          <TopBtn onClick={handleOpenHistory} label="🕐 Histórico" />
          <TopBtn onClick={() => setPanel('github')} label="⚙ GitHub" accent={hasGH} />
          <button
            onClick={handlePublish} disabled={publishing}
            style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 14px',borderRadius:7,background:publishing?'#444':'linear-gradient(135deg,#E8922A,#c77a1e)',color:'#000',fontSize:12,fontWeight:700,cursor:publishing?'not-allowed':'pointer',border:'none',whiteSpace:'nowrap',flexShrink:0 }}
          >
            {publishing ? '⟳ Publicando…' : '🚀 Publicar'}
          </button>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position:'fixed',top:60,right:12,zIndex:99999,padding:'10px 16px',borderRadius:10,background:toast.type==='success'?'#052e16':'#450a0a',border:`1px solid ${toast.type==='success'?'#166534':'#7f1d1d'}`,color:toast.type==='success'?'#86efac':'#fca5a5',fontSize:13,display:'flex',alignItems:'center',gap:10,maxWidth:400,boxShadow:'0 4px 24px rgba(0,0,0,0.6)' }}>
          <span style={{ flex:1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ color:'inherit',background:'none',border:'none',cursor:'pointer',fontSize:18,lineHeight:1 }}>×</button>
        </div>
      )}

      {/* ── GrapeJS canvas ── */}
      <div ref={containerRef} id="gjs" style={{ flex:1,overflow:'hidden' }} />

      {/* ── Panels overlay ── */}
      {panel && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,padding:16 }} onClick={e => { if(e.target===e.currentTarget) setPanel(null) }}>
          <div style={{ background:'#111',border:'1px solid #2a2a2a',borderRadius:16,padding:28,width:'100%',maxWidth:500,maxHeight:'80vh',overflow:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.8)' }}>

            {/* GitHub settings */}
            {panel === 'github' && (
              <>
                <h3 style={{ color:'#fff',fontSize:18,fontWeight:700,margin:'0 0 4px' }}>⚙ Configurações GitHub</h3>
                <p style={{ color:'#666',fontSize:13,margin:'0 0 20px' }}>Configure para publicar e puxar HTML do repositório do cliente.</p>
                <form onSubmit={handleSaveGH} style={{ display:'flex',flexDirection:'column',gap:14 }}>
                  {[
                    ['Repositório','usuario/repositorio','github_repo','usuario/meu-site'],
                    ['Arquivo HTML','Caminho dentro do repo','github_path','index.html'],
                    ['Branch','Geralmente main ou gh-pages','github_branch','main'],
                  ].map(([l,h,k,p]) => (
                    <div key={k}>
                      <label style={{ display:'block',color:'#ccc',fontSize:13,marginBottom:5 }}>{l} <span style={{ color:'#555',fontSize:11 }}>({h})</span></label>
                      <input value={ghForm[k]} onChange={e => setGhForm(f => ({ ...f, [k]: e.target.value }))} placeholder={p}
                        style={{ width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:9,padding:'10px 13px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box' }} />
                    </div>
                  ))}
                  <div style={{ display:'flex',gap:10,marginTop:4 }}>
                    <button type="button" onClick={() => setPanel(null)} style={{ flex:1,padding:'11px',borderRadius:9,border:'1px solid #2a2a2a',background:'transparent',color:'#888',cursor:'pointer',fontSize:14 }}>Cancelar</button>
                    <button type="submit" disabled={savingGH} style={{ flex:1,padding:'11px',borderRadius:9,background:savingGH?'#555':'#E8922A',color:'#000',fontWeight:700,cursor:'pointer',border:'none',fontSize:14 }}>{savingGH?'Salvando…':'Salvar'}</button>
                  </div>
                </form>

                {hasGH && (
                  <div style={{ marginTop:16,padding:14,background:'#1a1a1a',borderRadius:10,border:'1px solid #2a2a2a' }}>
                    <p style={{ color:'#888',fontSize:12,margin:'0 0 10px' }}>Após salvar, use "⬇ Do GitHub" na barra para carregar o HTML atual do repositório no editor.</p>
                  </div>
                )}
              </>
            )}

            {/* History */}
            {panel === 'history' && (
              <>
                <h3 style={{ color:'#fff',fontSize:18,fontWeight:700,margin:'0 0 4px' }}>🕐 Histórico de Versões</h3>
                <p style={{ color:'#666',fontSize:13,margin:'0 0 20px' }}>Últimas 10 versões salvas. Clique em "Restaurar" para voltar a uma versão anterior.</p>

                {loadingVersions ? (
                  <div style={{ textAlign:'center',padding:'24px',color:'#888' }}>Carregando...</div>
                ) : versions.length === 0 ? (
                  <div style={{ textAlign:'center',padding:'24px',color:'#666',fontSize:14 }}>
                    Nenhuma versão salva ainda.<br />
                    <span style={{ fontSize:12 }}>Use "💾 Salvar" para registrar uma versão.</span>
                  </div>
                ) : (
                  <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                    {versions.map((v, i) => (
                      <div key={v.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#1a1a1a',borderRadius:10,border:'1px solid #2a2a2a' }}>
                        <div>
                          <div style={{ color:'#fff',fontSize:13,fontWeight:600 }}>
                            {i === 0 ? '⭐ Versão mais recente' : `Versão ${versions.length - i}`}
                          </div>
                          <div style={{ color:'#666',fontSize:12,marginTop:2 }}>
                            {new Date(v.saved_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(v.id)}
                          disabled={restoringVersion === v.id}
                          style={{ padding:'7px 14px',background:restoringVersion===v.id?'#333':'#E8922A',color:restoringVersion===v.id?'#888':'#000',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700 }}
                        >
                          {restoringVersion === v.id ? 'Restaurando…' : 'Restaurar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => setPanel(null)} style={{ marginTop:16,width:'100%',padding:'11px',borderRadius:9,border:'1px solid #2a2a2a',background:'transparent',color:'#888',cursor:'pointer',fontSize:14 }}>Fechar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TopBtn({ onClick, label, title, disabled, accent }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,border:`1px solid ${accent?'#E8922A44':'#2a2a2a'}`,background:h?'#1e1e1e':'transparent',color:h||accent?'#E8922A':'#aaa',fontSize:12,cursor:disabled?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:disabled?0.5:1,flexShrink:0 }}
    >
      {label}
    </button>
  )
}
