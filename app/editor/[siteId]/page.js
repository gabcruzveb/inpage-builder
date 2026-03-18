'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authFetch } from '@/lib/api'

// ─── Ícones inline (SVG) ─────────────────────────────────────────────────────

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSave() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  )
}
function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  )
}
function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16,16 12,12 8,16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Constantes de estilo ─────────────────────────────────────────────────────

const topBarH = 52

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditorPage() {
  const { siteId } = useParams()
  const router = useRouter()

  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const saveTimer = useRef(null)

  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'
  const [publishing, setPublishing] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [ghForm, setGhForm] = useState({ github_repo: '', github_path: 'index.html', github_branch: 'main' })
  const [savingSettings, setSavingSettings] = useState(false)

  const [toast, setToast] = useState(null) // { type: 'success'|'error', msg: string }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Carregar site ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const res = await authFetch(`/api/sites/${siteId}`)
      if (!res.ok) {
        setLoadError('Site não encontrado ou sem permissão.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setSite(data)
      setGhForm({
        github_repo: data.github_repo || '',
        github_path: data.github_path || 'index.html',
        github_branch: data.github_branch || 'main',
      })
      setLoading(false)
    }
    load()
  }, [siteId])

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const doSave = useCallback(
    async (editor) => {
      if (!editor) return
      setSaveStatus('saving')
      try {
        const html = editor.getHtml()
        const css = editor.getCss()
        const gjson = editor.getProjectData()

        const res = await authFetch(`/api/sites/${siteId}`, {
          method: 'PUT',
          body: JSON.stringify({ html, css, gjson }),
        })
        setSaveStatus(res.ok ? 'saved' : 'unsaved')
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [siteId]
  )

  function scheduleSave(editor) {
    setSaveStatus('unsaved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(editor), 2000)
  }

  // ── Inicializar GrapeJS ────────────────────────────────────────────────────

  useEffect(() => {
    if (loading || !site || !containerRef.current) return

    let editor

    async function init() {
      // Importa GrapeJS e preset (somente no client)
      const [{ default: grapesjs }, { default: presetWebpage }] = await Promise.all([
        import('grapesjs'),
        import('grapesjs-preset-webpage'),
      ])

      // CSS do GrapeJS
      if (!document.getElementById('gjs-styles')) {
        const link = document.createElement('link')
        link.id = 'gjs-styles'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css'
        document.head.appendChild(link)
      }

      editor = grapesjs.init({
        container: containerRef.current,
        height: '100%',
        width: 'auto',
        storageManager: false,
        plugins: [presetWebpage],
        pluginsOpts: {
          [presetWebpage]: {
            modalImportTitle: 'Importar Template',
            modalImportLabel: '<p style="color:#aaa;font-size:13px;margin-bottom:8px">Cole o HTML do seu template</p>',
          },
        },
        canvas: {
          styles: [],
          scripts: [],
        },
      })

      // Carrega conteúdo existente
      if (site.gjson) {
        try {
          const gjson = typeof site.gjson === 'string' ? JSON.parse(site.gjson) : site.gjson
          editor.loadProjectData(gjson)
        } catch {
          if (site.html) editor.setComponents(site.html)
          if (site.css) editor.setStyle(site.css)
        }
      } else {
        if (site.html) editor.setComponents(site.html)
        if (site.css) editor.setStyle(site.css)
      }

      editorRef.current = editor

      // Eventos para auto-save
      editor.on('component:update', () => scheduleSave(editor))
      editor.on('component:add', () => scheduleSave(editor))
      editor.on('component:remove', () => scheduleSave(editor))
      editor.on('style:update', () => scheduleSave(editor))
    }

    init()

    return () => {
      clearTimeout(saveTimer.current)
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
      }
    }
  }, [loading, site]) // eslint-disable-line

  // ── Publicar ───────────────────────────────────────────────────────────────

  async function handlePublish() {
    setPublishing(true)
    try {
      if (editorRef.current) await doSave(editorRef.current)

      const res = await authFetch('/api/publish', {
        method: 'POST',
        body: JSON.stringify({ siteId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('success', 'Site publicado no GitHub com sucesso!')
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setPublishing(false)
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  function handlePreview() {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.getHtml()
    const css = editor.getCss()
    const full = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${site?.name || 'Preview'}</title>
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`
    const blob = new Blob([full], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // ── Salvar configurações do GitHub ─────────────────────────────────────────

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await authFetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify(ghForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSite((prev) => ({ ...prev, ...ghForm }))
      setShowSettings(false)
      showToast('success', 'Configurações do GitHub salvas!')
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E8922A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff', gap: 16 }}>
        <p style={{ color: '#f87171' }}>{loadError}</p>
        <a href="/dashboard" style={{ color: '#E8922A', textDecoration: 'underline' }}>Voltar ao dashboard</a>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <header style={{
        height: topBarH,
        background: '#111',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 10,
        flexShrink: 0,
        zIndex: 9999,
      }}>

        {/* Back */}
        <a
          href="/dashboard"
          title="Voltar ao dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', textDecoration: 'none', fontSize: 13, padding: '5px 10px', borderRadius: 8, border: '1px solid #2a2a2a', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#444' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#2a2a2a' }}
        >
          <IconBack />
          <span>Dashboard</span>
        </a>

        {/* Divisor */}
        <div style={{ width: 1, height: 24, background: '#2a2a2a' }} />

        {/* Nome do site */}
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {site?.name}
        </span>

        {/* Status de save */}
        <span style={{
          fontSize: 12,
          color: saveStatus === 'saved' ? '#4ade80' : saveStatus === 'saving' ? '#E8922A' : '#f87171',
          whiteSpace: 'nowrap',
          minWidth: 90,
          textAlign: 'right',
        }}>
          {saveStatus === 'saved' ? '✓ Salvo' : saveStatus === 'saving' ? '⟳ Salvando…' : '● Não salvo'}
        </span>

        {/* Btn: Salvar */}
        <Btn
          onClick={() => doSave(editorRef.current)}
          icon={<IconSave />}
          label="Salvar"
        />

        {/* Btn: Visualizar */}
        <Btn
          onClick={handlePreview}
          icon={<IconEye />}
          label="Visualizar"
        />

        {/* Btn: GitHub */}
        <Btn
          onClick={() => setShowSettings(true)}
          icon={<IconGitHub />}
          label="GitHub"
        />

        {/* Btn: Publicar */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 16px',
            borderRadius: 8,
            background: publishing ? '#555' : 'linear-gradient(135deg, #E8922A, #c77a1e)',
            color: '#000',
            fontSize: 13,
            fontWeight: 700,
            cursor: publishing ? 'not-allowed' : 'pointer',
            border: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          <IconUpload />
          {publishing ? 'Publicando…' : 'Publicar'}
        </button>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: topBarH + 8, right: 12, zIndex: 99999,
          padding: '10px 16px',
          borderRadius: 10,
          background: toast.type === 'success' ? '#052e16' : '#450a0a',
          border: `1px solid ${toast.type === 'success' ? '#166534' : '#7f1d1d'}`,
          color: toast.type === 'success' ? '#86efac' : '#fca5a5',
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          maxWidth: 360,
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Canvas GrapeJS ── */}
      <div
        ref={containerRef}
        id="gjs"
        style={{ flex: 1, overflow: 'hidden' }}
      />

      {/* ── Modal: Configurações GitHub ── */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
          padding: 16,
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: 16,
            padding: 28,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          }}>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              Configurações GitHub
            </h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
              Defina onde o site será publicado ao clicar em "Publicar".
            </p>

            <form onSubmit={handleSaveSettings}>
              <Field
                label="Repositório"
                hint="Formato: usuario/repositorio"
                value={ghForm.github_repo}
                onChange={v => setGhForm(f => ({ ...f, github_repo: v }))}
                placeholder="usuario/meu-site"
              />
              <Field
                label="Caminho do arquivo"
                hint='Geralmente "index.html"'
                value={ghForm.github_path}
                onChange={v => setGhForm(f => ({ ...f, github_path: v }))}
                placeholder="index.html"
              />
              <Field
                label="Branch"
                hint='Geralmente "main" ou "gh-pages"'
                value={ghForm.github_branch}
                onChange={v => setGhForm(f => ({ ...f, github_branch: v }))}
                placeholder="main"
              />

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #2a2a2a', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: savingSettings ? '#555' : '#E8922A', color: '#000', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 }}
                >
                  {savingSettings ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Btn({ onClick, icon, label }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        borderRadius: 8,
        border: '1px solid #2a2a2a',
        background: hov ? '#1e1e1e' : 'transparent',
        color: hov ? '#fff' : '#aaa',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function Field({ label, hint, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: '#ccc', fontSize: 13, marginBottom: 4 }}>
        {label}
        {hint && <span style={{ color: '#555', fontSize: 12, marginLeft: 6 }}>({hint})</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 10,
          padding: '10px 14px',
          color: '#fff',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = '#E8922A')}
        onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
      />
    </div>
  )
}
