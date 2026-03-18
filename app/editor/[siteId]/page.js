'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { authFetch } from '@/lib/api'

const topBarH = 52

export default function EditorPage() {
  const { siteId } = useParams()

  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const saveTimer = useRef(null)

  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [publishing, setPublishing] = useState(false)
  const [showGH, setShowGH] = useState(false)
  const [ghForm, setGhForm] = useState({ github_repo: '', github_path: 'index.html', github_branch: 'main' })
  const [savingGH, setSavingGH] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Carregar site ─────────────────────────────────────────────────────────
  useEffect(() => {
    authFetch(`/api/sites/${siteId}`).then(async (res) => {
      if (!res.ok) { setLoadError('Site não encontrado.'); setLoading(false); return }
      const d = await res.json()
      setSite(d)
      setGhForm({ github_repo: d.github_repo || '', github_path: d.github_path || 'index.html', github_branch: d.github_branch || 'main' })
      setLoading(false)
    })
  }, [siteId])

  // ── Auto-save ─────────────────────────────────────────────────────────────
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
    saveTimer.current = setTimeout(() => doSave(editor), 2000)
  }

  // ── Init GrapeJS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !site || !containerRef.current) return
    let editor

    async function init() {
      const [{ default: grapesjs }, { default: presetWebpage }] = await Promise.all([
        import('grapesjs'),
        import('grapesjs-preset-webpage'),
      ])

      if (!document.getElementById('gjs-styles')) {
        const link = document.createElement('link')
        link.id = 'gjs-styles'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css'
        document.head.appendChild(link)
      }

      // Inject custom PT-BR styles for GrapeJS UI
      if (!document.getElementById('gjs-custom')) {
        const s = document.createElement('style')
        s.id = 'gjs-custom'
        s.textContent = `
          .gjs-pn-panels { background: #111 !important; }
          .gjs-pn-panel { background: #161616 !important; border-color: #222 !important; }
          .gjs-pn-btn { color: #aaa !important; }
          .gjs-pn-btn:hover, .gjs-pn-btn.gjs-pn-active { color: #E8922A !important; }
          .gjs-blocks-c { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 8px; }
          .gjs-block { border-color: #2a2a2a !important; background: #1a1a1a !important; color: #ccc !important; border-radius: 8px !important; padding: 10px 6px !important; }
          .gjs-block:hover { border-color: #E8922A !important; color: #E8922A !important; background: #1e1a14 !important; }
          .gjs-block__media { color: #E8922A !important; }
          .gjs-cv-canvas { background: #e5e5e5 !important; }
          .gjs-toolbar { background: #1a1a1a !important; border-color: #333 !important; }
          .gjs-toolbar-item { color: #aaa !important; }
          .gjs-toolbar-item:hover { color: #E8922A !important; background: #222 !important; }
          .gjs-resizer-h { border-color: #E8922A !important; }
          .gjs-selected { outline: 2px solid #E8922A !important; }
          .gjs-hovered { outline: 1px dashed #E8922A88 !important; }
          .gjs-sm-sector-title, .gjs-layer-title { background: #1a1a1a !important; color: #ccc !important; border-color: #2a2a2a !important; }
          .gjs-sm-property { border-color: #2a2a2a !important; }
          .gjs-sm-label { color: #888 !important; }
          .gjs-field { background: #1a1a1a !important; border-color: #2a2a2a !important; color: #fff !important; }
          .gjs-field:focus { border-color: #E8922A !important; }
          .gjs-trt-traits { background: #111 !important; }
          .gjs-color-picker { background: #1a1a1a !important; }
          .gjs-block-category .gjs-title { background: #1a1a1a !important; color: #E8922A !important; border-color: #2a2a2a !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .gjs-mdl-dialog { background: #111 !important; border-color: #2a2a2a !important; }
          .gjs-mdl-header { background: #161616 !important; color: #fff !important; border-color: #2a2a2a !important; }
          .gjs-mdl-content { background: #111 !important; color: #ccc !important; }
          .gjs-btn-prim { background: #E8922A !important; color: #000 !important; border: none !important; }
          .gjs-cm-editor-c { background: #0d0d0d !important; }
          .gjs-layers { background: #111 !important; }
          .gjs-layer { background: #161616 !important; color: #ccc !important; border-color: #2a2a2a !important; }
          .gjs-layer:hover { background: #1a1a1a !important; }
          .gjs-layer.gjs-selected { background: #1e1a14 !important; color: #E8922A !important; }
          .sp-picker-container { background: #1a1a1a !important; }
        `
        document.head.appendChild(s)
      }

      editor = grapesjs.init({
        container: containerRef.current,
        height: '100%',
        width: 'auto',
        storageManager: false,
        plugins: [presetWebpage],
        pluginsOpts: {
          [presetWebpage]: {
            modalImportTitle: 'Importar HTML',
            modalImportLabel: '<p style="color:#aaa;font-size:13px;margin-bottom:8px">Cole o código HTML do seu site existente aqui. Isso substituirá o conteúdo atual.</p>',
            modalImportButton: 'Importar',
            showStylesOnChange: true,
          },
        },
        i18n: {
          locale: 'pt',
          messages: {
            pt: {
              styleManager: { properties: { float: 'Float', display: 'Display', top: 'Topo', right: 'Direita', left: 'Esquerda', bottom: 'Fundo', width: 'Largura', height: 'Altura', 'max-width': 'Larg. máxima', 'min-height': 'Alt. mínima', margin: 'Margem', padding: 'Espaçamento interno', 'font-family': 'Fonte', 'font-size': 'Tamanho', 'font-weight': 'Peso', 'letter-spacing': 'Espaço letras', color: 'Cor', 'line-height': 'Alt. linha', 'text-align': 'Alinhamento', 'text-shadow': 'Sombra texto', background: 'Fundo', 'background-color': 'Cor de fundo', 'border-radius': 'Borda arredondada', border: 'Borda', 'box-shadow': 'Sombra', transition: 'Transição', transform: 'Transformar', flex: 'Flex', 'flex-direction': 'Direção flex', 'justify-content': 'Justificar', 'align-items': 'Alinhar itens', 'flex-wrap': 'Quebra flex', opacity: 'Opacidade', overflow: 'Overflow', position: 'Posição', cursor: 'Cursor', 'text-decoration': 'Decoração', 'background-image': 'Imagem de fundo', 'background-repeat': 'Repetição fundo', 'background-position': 'Posição fundo', 'background-size': 'Tamanho fundo' } },
              traitManager: { empty: 'Selecione um elemento para ver suas propriedades' },
              domComponents: { names: { '': 'Caixa', wrapper: 'Corpo', text: 'Texto', comment: 'Comentário', image: 'Imagem', video: 'Vídeo', label: 'Label', link: 'Link', map: 'Mapa', tfoot: 'Rodapé tabela', tbody: 'Corpo tabela', thead: 'Cabeçalho tabela', table: 'Tabela', row: 'Linha', cell: 'Célula' } },
              blockManager: { labels: {} },
              panels: {},
              deviceManager: { devices: [{ name: 'Desktop', width: '' }, { name: 'Tablet', width: '768px' }, { name: 'Mobile', width: '375px' }] },
            },
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

      // ── Blocos personalizados PT-BR ────────────────────────────────────────
      const bm = editor.BlockManager

      // Remove categoria padrão e adiciona categorias PT-BR
      const sections = [
        {
          category: '🦸 Hero / Cabeçalho',
          blocks: [
            {
              id: 'hero-simples', label: 'Hero Simples',
              content: `<section style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:80px 20px;text-align:center;font-family:sans-serif">
  <h1 style="color:#fff;font-size:48px;font-weight:800;margin:0 0 16px">Seu Título Principal</h1>
  <p style="color:#94a3b8;font-size:20px;margin:0 0 32px;max-width:600px;margin-left:auto;margin-right:auto">Uma descrição atraente sobre seu produto ou serviço que convence o visitante a agir.</p>
  <a href="#" style="display:inline-block;background:linear-gradient(135deg,#E8922A,#c77a1e);color:#000;padding:16px 40px;border-radius:50px;font-weight:700;font-size:18px;text-decoration:none">Começar Agora</a>
</section>`,
            },
            {
              id: 'hero-foto', label: 'Hero com Foto',
              content: `<section style="display:flex;align-items:center;gap:40px;padding:80px 60px;background:#0f0f23;font-family:sans-serif;flex-wrap:wrap">
  <div style="flex:1;min-width:280px">
    <span style="background:#E8922A22;color:#E8922A;padding:6px 16px;border-radius:50px;font-size:14px;font-weight:600">Novo Produto</span>
    <h1 style="color:#fff;font-size:42px;font-weight:800;margin:16px 0">Transforme Seu Negócio Digital</h1>
    <p style="color:#94a3b8;font-size:17px;line-height:1.7;margin:0 0 32px">Solução completa para empresas que querem crescer online com resultados reais.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="#" style="display:inline-block;background:#E8922A;color:#000;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none">Ver Planos</a>
      <a href="#" style="display:inline-block;background:transparent;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;text-decoration:none;border:1px solid #333">Saiba Mais</a>
    </div>
  </div>
  <div style="flex:1;min-width:280px;background:#1a1a3e;border-radius:16px;height:320px;display:flex;align-items:center;justify-content:center;color:#E8922A;font-size:14px">📷 Coloque sua imagem aqui</div>
</section>`,
            },
            {
              id: 'hero-centralizado', label: 'Hero Centralizado',
              content: `<section style="padding:100px 20px;text-align:center;background:#fff;font-family:sans-serif">
  <p style="color:#E8922A;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">Bem-vindo</p>
  <h1 style="color:#111;font-size:52px;font-weight:900;margin:0 0 20px;line-height:1.1">Criamos Sites que<br><span style="color:#E8922A">Convertem</span></h1>
  <p style="color:#666;font-size:18px;max-width:560px;margin:0 auto 40px;line-height:1.7">Design moderno, carregamento rápido e foco total em trazer resultados para o seu negócio.</p>
  <a href="#" style="display:inline-block;background:#111;color:#fff;padding:18px 48px;border-radius:50px;font-weight:700;font-size:16px;text-decoration:none">Solicitar Orçamento</a>
</section>`,
            },
          ],
        },
        {
          category: '📦 Serviços / Features',
          blocks: [
            {
              id: 'servicos-3col', label: 'Serviços 3 Colunas',
              content: `<section style="padding:80px 40px;background:#f8f9fa;font-family:sans-serif">
  <div style="text-align:center;margin-bottom:48px">
    <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 12px">Nossos Serviços</h2>
    <p style="color:#666;font-size:17px">Tudo que você precisa para ter sucesso online</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1000px;margin:0 auto">
    ${[['🎨','Design','Criamos layouts modernos e intuitivos que encantam seus visitantes.'],['⚡','Performance','Sites ultra-rápidos com carregamento otimizado para melhor experiência.'],['📱','Responsivo','Perfeito em qualquer dispositivo: desktop, tablet ou celular.']].map(([i,t,d]) => `
    <div style="background:#fff;border-radius:16px;padding:32px 24px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <div style="font-size:40px;margin-bottom:16px">${i}</div>
      <h3 style="color:#111;font-size:20px;font-weight:700;margin:0 0 12px">${t}</h3>
      <p style="color:#666;font-size:15px;line-height:1.6">${d}</p>
    </div>`).join('')}
  </div>
</section>`,
            },
            {
              id: 'servicos-lista', label: 'Serviços com Ícone',
              content: `<section style="padding:80px 40px;background:#fff;font-family:sans-serif">
  <div style="max-width:900px;margin:0 auto">
    <h2 style="color:#111;font-size:36px;font-weight:800;text-align:center;margin:0 0 48px">O que fazemos</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      ${[['🛒','E-commerce','Lojas virtuais completas integradas com os principais meios de pagamento.'],['📊','Marketing Digital','Estratégias de SEO, tráfego pago e redes sociais para atrair clientes.'],['💬','Suporte 24/7','Equipe dedicada sempre pronta para resolver qualquer problema.'],['🔒','Segurança','Certificados SSL, backups automáticos e proteção total do seu site.']].map(([i,t,d]) => `
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div style="background:#E8922A22;border-radius:12px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${i}</div>
        <div>
          <h3 style="color:#111;font-size:18px;font-weight:700;margin:0 0 8px">${t}</h3>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:0">${d}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`,
            },
          ],
        },
        {
          category: '👥 Sobre / Time',
          blocks: [
            {
              id: 'sobre-empresa', label: 'Sobre a Empresa',
              content: `<section style="padding:80px 40px;background:#fff;font-family:sans-serif">
  <div style="max-width:900px;margin:0 auto;display:flex;gap:60px;align-items:center;flex-wrap:wrap">
    <div style="flex:1;min-width:260px;background:#f0f0f0;border-radius:16px;height:300px;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px">📷 Foto da empresa</div>
    <div style="flex:1;min-width:260px">
      <p style="color:#E8922A;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">Sobre Nós</p>
      <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 20px;line-height:1.2">Mais de 10 anos criando experiências digitais</h2>
      <p style="color:#666;font-size:16px;line-height:1.7;margin:0 0 24px">Somos uma agência apaixonada por tecnologia e resultados. Nossa missão é transformar negócios através de soluções digitais inovadoras.</p>
      <div style="display:flex;gap:32px;margin-bottom:32px">
        <div><div style="color:#E8922A;font-size:32px;font-weight:800">+500</div><div style="color:#666;font-size:14px">Projetos</div></div>
        <div><div style="color:#E8922A;font-size:32px;font-weight:800">98%</div><div style="color:#666;font-size:14px">Satisfação</div></div>
        <div><div style="color:#E8922A;font-size:32px;font-weight:800">10+</div><div style="color:#666;font-size:14px">Anos</div></div>
      </div>
      <a href="#" style="display:inline-block;background:#111;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;text-decoration:none">Conheça a equipe</a>
    </div>
  </div>
</section>`,
            },
            {
              id: 'time-cards', label: 'Time / Equipe',
              content: `<section style="padding:80px 40px;background:#f8f9fa;font-family:sans-serif">
  <div style="text-align:center;margin-bottom:48px">
    <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 12px">Nossa Equipe</h2>
    <p style="color:#666;font-size:17px">Profissionais apaixonados pelo que fazem</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:900px;margin:0 auto">
    ${[['João Silva','CEO & Fundador','10 anos de experiência em gestão digital'],['Ana Costa','Designers Chefe','Especialista em UX/UI e identidade visual'],['Pedro Souza','Dev Full-Stack','Expert em React, Node.js e cloud computing']].map(([n,r,d]) => `
    <div style="background:#fff;border-radius:16px;padding:32px 24px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <div style="width:80px;height:80px;background:#E8922A22;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px">👤</div>
      <h3 style="color:#111;font-size:18px;font-weight:700;margin:0 0 4px">${n}</h3>
      <p style="color:#E8922A;font-size:13px;font-weight:600;margin:0 0 12px">${r}</p>
      <p style="color:#666;font-size:14px;line-height:1.5;margin:0">${d}</p>
    </div>`).join('')}
  </div>
</section>`,
            },
          ],
        },
        {
          category: '💬 Depoimentos',
          blocks: [
            {
              id: 'depoimentos', label: 'Depoimentos',
              content: `<section style="padding:80px 40px;background:#fff;font-family:sans-serif">
  <div style="text-align:center;margin-bottom:48px">
    <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 12px">O que dizem nossos clientes</h2>
    <p style="color:#666;font-size:17px">Resultados reais de clientes reais</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1000px;margin:0 auto">
    ${[['Maria S.','Dona de restaurante','O site novo triplicou nossas reservas online. Incrível o trabalho da equipe!'],['Carlos M.','Médico','Minha clínica ficou com uma presença digital profissional. Super recomendo!'],['Laura P.','Loja de roupas','Nossas vendas online cresceram 200% depois do novo site. Resultado fantástico!']].map(([n,r,t]) => `
    <div style="background:#f8f9fa;border-radius:16px;padding:28px 24px;border-left:4px solid #E8922A">
      <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;font-style:italic">"${t}"</p>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;background:#E8922A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700;font-size:16px">${n[0]}</div>
        <div>
          <div style="color:#111;font-weight:700;font-size:14px">${n}</div>
          <div style="color:#999;font-size:12px">${r}</div>
        </div>
      </div>
    </div>`).join('')}
  </div>
</section>`,
            },
          ],
        },
        {
          category: '💰 Preços / Planos',
          blocks: [
            {
              id: 'precos', label: 'Tabela de Preços',
              content: `<section style="padding:80px 40px;background:#f8f9fa;font-family:sans-serif">
  <div style="text-align:center;margin-bottom:48px">
    <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 12px">Planos e Preços</h2>
    <p style="color:#666;font-size:17px">Escolha o plano ideal para o seu negócio</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:900px;margin:0 auto">
    <div style="background:#fff;border-radius:16px;padding:32px 24px;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <h3 style="color:#111;font-size:18px;font-weight:700;margin:0 0 8px">Básico</h3>
      <div style="color:#E8922A;font-size:40px;font-weight:900;margin:0 0 20px">R$99<span style="font-size:16px;color:#999">/mês</span></div>
      ${['5 páginas','SSL gratuito','Suporte email','1 conta de email'].map(f => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;color:#555;font-size:14px"><span style="color:#4ade80">✓</span>${f}</div>`).join('')}
      <a href="#" style="display:block;text-align:center;background:#111;color:#fff;padding:14px;border-radius:10px;font-weight:600;text-decoration:none;margin-top:24px">Contratar</a>
    </div>
    <div style="background:#111;border-radius:16px;padding:32px 24px;box-shadow:0 8px 40px rgba(0,0,0,0.2);transform:scale(1.05);position:relative;overflow:hidden">
      <div style="position:absolute;top:12px;right:12px;background:#E8922A;color:#000;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px">POPULAR</div>
      <h3 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px">Profissional</h3>
      <div style="color:#E8922A;font-size:40px;font-weight:900;margin:0 0 20px">R$199<span style="font-size:16px;color:#666">/mês</span></div>
      ${['Páginas ilimitadas','SSL + CDN','Suporte 24/7','10 contas de email','Blog integrado'].map(f => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;color:#ccc;font-size:14px"><span style="color:#E8922A">✓</span>${f}</div>`).join('')}
      <a href="#" style="display:block;text-align:center;background:#E8922A;color:#000;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:24px">Contratar</a>
    </div>
    <div style="background:#fff;border-radius:16px;padding:32px 24px;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <h3 style="color:#111;font-size:18px;font-weight:700;margin:0 0 8px">Enterprise</h3>
      <div style="color:#E8922A;font-size:40px;font-weight:900;margin:0 0 20px">R$499<span style="font-size:16px;color:#999">/mês</span></div>
      ${['Tudo do Pro','E-commerce','API personalizada','SLA garantido','Gerente dedicado'].map(f => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;color:#555;font-size:14px"><span style="color:#4ade80">✓</span>${f}</div>`).join('')}
      <a href="#" style="display:block;text-align:center;background:#111;color:#fff;padding:14px;border-radius:10px;font-weight:600;text-decoration:none;margin-top:24px">Contratar</a>
    </div>
  </div>
</section>`,
            },
          ],
        },
        {
          category: '📧 Contato / CTA',
          blocks: [
            {
              id: 'cta-simples', label: 'Chamada para Ação',
              content: `<section style="padding:80px 40px;background:linear-gradient(135deg,#E8922A,#c77a1e);text-align:center;font-family:sans-serif">
  <h2 style="color:#000;font-size:40px;font-weight:900;margin:0 0 16px">Pronto para Começar?</h2>
  <p style="color:#000;font-size:18px;opacity:0.8;margin:0 0 32px">Entre em contato hoje e receba um orçamento gratuito em 24 horas.</p>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
    <a href="#" style="display:inline-block;background:#000;color:#fff;padding:16px 40px;border-radius:50px;font-weight:700;font-size:16px;text-decoration:none">Falar com Especialista</a>
    <a href="#" style="display:inline-block;background:transparent;color:#000;padding:16px 40px;border-radius:50px;font-weight:700;font-size:16px;text-decoration:none;border:2px solid #000">Ver Portfólio</a>
  </div>
</section>`,
            },
            {
              id: 'formulario-contato', label: 'Formulário de Contato',
              content: `<section style="padding:80px 40px;background:#fff;font-family:sans-serif">
  <div style="max-width:600px;margin:0 auto">
    <div style="text-align:center;margin-bottom:40px">
      <h2 style="color:#111;font-size:36px;font-weight:800;margin:0 0 12px">Entre em Contato</h2>
      <p style="color:#666;font-size:17px">Responderemos em até 24 horas</p>
    </div>
    <form style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><label style="display:block;color:#444;font-size:14px;font-weight:600;margin-bottom:6px">Nome</label><input type="text" placeholder="Seu nome" style="width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:10px;font-size:15px;outline:none;box-sizing:border-box"></div>
        <div><label style="display:block;color:#444;font-size:14px;font-weight:600;margin-bottom:6px">E-mail</label><input type="email" placeholder="seu@email.com" style="width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:10px;font-size:15px;outline:none;box-sizing:border-box"></div>
      </div>
      <div><label style="display:block;color:#444;font-size:14px;font-weight:600;margin-bottom:6px">Assunto</label><input type="text" placeholder="Como podemos ajudar?" style="width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:10px;font-size:15px;outline:none;box-sizing:border-box"></div>
      <div><label style="display:block;color:#444;font-size:14px;font-weight:600;margin-bottom:6px">Mensagem</label><textarea placeholder="Descreva sua necessidade..." rows="5" style="width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:10px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea></div>
      <button type="submit" style="background:linear-gradient(135deg,#E8922A,#c77a1e);color:#000;padding:16px;border-radius:10px;font-weight:700;font-size:16px;border:none;cursor:pointer">Enviar Mensagem</button>
    </form>
  </div>
</section>`,
            },
          ],
        },
        {
          category: '🔢 Números / Stats',
          blocks: [
            {
              id: 'stats', label: 'Números / Estatísticas',
              content: `<section style="padding:60px 40px;background:#111;font-family:sans-serif">
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px;max-width:900px;margin:0 auto;text-align:center">
    ${[['500+','Projetos entregues'],['98%','Clientes satisfeitos'],['10+','Anos de experiência'],['24/7','Suporte disponível']].map(([n,l]) => `
    <div>
      <div style="color:#E8922A;font-size:48px;font-weight:900;line-height:1">${n}</div>
      <div style="color:#888;font-size:14px;margin-top:8px">${l}</div>
    </div>`).join('')}
  </div>
</section>`,
            },
          ],
        },
        {
          category: '🦶 Rodapé',
          blocks: [
            {
              id: 'footer-simples', label: 'Rodapé Simples',
              content: `<footer style="background:#111;padding:40px;text-align:center;font-family:sans-serif">
  <div style="color:#E8922A;font-size:22px;font-weight:800;margin-bottom:16px">Sua Empresa</div>
  <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:24px">
    ${['Início','Serviços','Sobre','Contato'].map(l => `<a href="#" style="color:#888;text-decoration:none;font-size:14px;hover:color:#fff">${l}</a>`).join('')}
  </div>
  <p style="color:#555;font-size:13px;margin:0">© ${new Date().getFullYear()} Sua Empresa. Todos os direitos reservados.</p>
</footer>`,
            },
            {
              id: 'footer-completo', label: 'Rodapé Completo',
              content: `<footer style="background:#0a0a0a;padding:60px 40px 30px;font-family:sans-serif">
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;max-width:1000px;margin:0 auto;padding-bottom:40px;border-bottom:1px solid #1a1a1a">
    <div>
      <div style="color:#E8922A;font-size:22px;font-weight:800;margin-bottom:12px">Sua Empresa</div>
      <p style="color:#666;font-size:14px;line-height:1.7">Criamos soluções digitais que geram resultados reais para o seu negócio.</p>
    </div>
    ${[['Serviços',['Sites','E-commerce','Marketing','SEO']],['Empresa',['Sobre','Equipe','Blog','Carreiras']],['Contato',['WhatsApp','Email','Instagram','LinkedIn']]].map(([t,l]) => `
    <div>
      <h4 style="color:#fff;font-size:14px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:1px">${t}</h4>
      ${l.map(i => `<div style="margin-bottom:10px"><a href="#" style="color:#666;text-decoration:none;font-size:14px">${i}</a></div>`).join('')}
    </div>`).join('')}
  </div>
  <div style="max-width:1000px;margin:24px auto 0;text-align:center;color:#444;font-size:13px">© ${new Date().getFullYear()} Sua Empresa. Todos os direitos reservados.</div>
</footer>`,
            },
          ],
        },
        {
          category: '🧩 Elementos',
          blocks: [
            {
              id: 'botao', label: 'Botão',
              content: `<a href="#" style="display:inline-block;background:#E8922A;color:#000;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;font-family:sans-serif">Clique Aqui</a>`,
            },
            {
              id: 'divisor', label: 'Divisor / Separador',
              content: `<div style="padding:40px;text-align:center;font-family:sans-serif"><div style="height:1px;background:linear-gradient(90deg,transparent,#E8922A,transparent)"></div></div>`,
            },
            {
              id: 'badge', label: 'Badge / Etiqueta',
              content: `<span style="display:inline-block;background:#E8922A22;color:#E8922A;padding:6px 16px;border-radius:50px;font-size:13px;font-weight:700;font-family:sans-serif;border:1px solid #E8922A44">✨ Destaque</span>`,
            },
            {
              id: 'alerta', label: 'Caixa de Alerta',
              content: `<div style="background:#fff3cd;border-left:4px solid #E8922A;padding:16px 20px;border-radius:8px;font-family:sans-serif;margin:16px 0"><strong style="color:#856404">⚠️ Atenção:</strong> <span style="color:#533f03">Insira aqui uma mensagem importante para seus visitantes.</span></div>`,
            },
            {
              id: 'video', label: 'Vídeo YouTube',
              content: `<div style="max-width:800px;margin:40px auto;padding:0 20px"><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe></div></div>`,
            },
          ],
        },
      ]

      // Clear existing blocks and add custom ones
      bm.getAll().reset()
      sections.forEach(({ category, blocks }) => {
        blocks.forEach(({ id, label, content }) => {
          bm.add(id, {
            label,
            category,
            content,
            attributes: { class: 'fa fa-th' },
          })
        })
      })

      // Load existing content
      if (site.gjson) {
        try {
          editor.loadProjectData(typeof site.gjson === 'string' ? JSON.parse(site.gjson) : site.gjson)
        } catch {
          if (site.html) editor.setComponents(site.html)
          if (site.css) editor.setStyle(site.css)
        }
      } else {
        if (site.html) editor.setComponents(site.html)
        if (site.css) editor.setStyle(site.css)
      }

      editorRef.current = editor

      editor.on('component:update', () => scheduleSave(editor))
      editor.on('component:add', () => scheduleSave(editor))
      editor.on('component:remove', () => scheduleSave(editor))
      editor.on('style:update', () => scheduleSave(editor))
    }

    init()
    return () => {
      clearTimeout(saveTimer.current)
      if (editorRef.current) { editorRef.current.destroy(); editorRef.current = null }
    }
  }, [loading, site]) // eslint-disable-line

  // ── Publicar ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true)
    try {
      if (editorRef.current) await doSave(editorRef.current)
      const res = await authFetch('/api/publish', { method: 'POST', body: JSON.stringify({ siteId }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      showToast('success', '✓ Publicado no GitHub com sucesso!')
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setPublishing(false)
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  function handlePreview() {
    const ed = editorRef.current
    if (!ed) return
    window.open(`/s/${site?.slug}`, '_blank')
  }

  // ── Importar HTML ─────────────────────────────────────────────────────────
  function handleImport() {
    editorRef.current?.runCommand('gjs-open-import-webpage')
  }

  // ── Salvar configurações GitHub ───────────────────────────────────────────
  async function handleSaveGH(e) {
    e.preventDefault(); setSavingGH(true)
    try {
      const res = await authFetch(`/api/sites/${siteId}`, { method: 'PUT', body: JSON.stringify(ghForm) })
      if (!res.ok) throw new Error((await res.json()).error)
      setSite(p => ({ ...p, ...ghForm })); setShowGH(false)
      showToast('success', 'Configurações salvas!')
    } catch (err) { showToast('error', err.message) }
    finally { setSavingGH(false) }
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000' }}>
      <div style={{ width:32,height:32,border:'2px solid #E8922A',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (loadError) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000',color:'#fff',gap:16 }}>
      <p style={{ color:'#f87171' }}>{loadError}</p>
      <a href="/dashboard" style={{ color:'#E8922A',textDecoration:'underline' }}>Voltar</a>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:'#111',overflow:'hidden' }}>

      {/* Top bar */}
      <header style={{ height:topBarH,background:'#111',borderBottom:'1px solid #222',display:'flex',alignItems:'center',padding:'0 12px',gap:8,flexShrink:0,zIndex:9999 }}>

        <a href="/dashboard" style={{ display:'flex',alignItems:'center',gap:5,color:'#888',textDecoration:'none',fontSize:13,padding:'5px 10px',borderRadius:8,border:'1px solid #2a2a2a',whiteSpace:'nowrap' }}>
          ← Dashboard
        </a>

        <div style={{ width:1,height:24,background:'#2a2a2a',flexShrink:0 }} />

        <span style={{ color:'#fff',fontWeight:600,fontSize:14,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
          {site?.name}
        </span>

        <span style={{ fontSize:12,color:saveStatus==='saved'?'#4ade80':saveStatus==='saving'?'#E8922A':'#f87171',whiteSpace:'nowrap' }}>
          {saveStatus==='saved'?'✓ Salvo':saveStatus==='saving'?'⟳ Salvando…':'● Não salvo'}
        </span>

        <TBtn onClick={() => doSave(editorRef.current)} label="💾 Salvar" />
        <TBtn onClick={handlePreview} label="👁 Visualizar" />
        <TBtn onClick={handleImport} label="📥 Importar HTML" title="Importe o código HTML de um site existente" />
        <TBtn onClick={() => setShowGH(true)} label="⚙ GitHub" />

        <button onClick={handlePublish} disabled={publishing} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:8,background:publishing?'#555':'linear-gradient(135deg,#E8922A,#c77a1e)',color:'#000',fontSize:13,fontWeight:700,cursor:publishing?'not-allowed':'pointer',border:'none',whiteSpace:'nowrap' }}>
          {publishing ? '⟳ Publicando…' : '🚀 Publicar'}
        </button>
      </header>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed',top:topBarH+8,right:12,zIndex:99999,padding:'10px 16px',borderRadius:10,background:toast.type==='success'?'#052e16':'#450a0a',border:`1px solid ${toast.type==='success'?'#166534':'#7f1d1d'}`,color:toast.type==='success'?'#86efac':'#fca5a5',fontSize:13,display:'flex',alignItems:'center',gap:10,maxWidth:360,boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <span style={{ flex:1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ color:'inherit',background:'none',border:'none',cursor:'pointer',fontSize:16 }}>×</button>
        </div>
      )}

      {/* GrapeJS canvas */}
      <div ref={containerRef} id="gjs" style={{ flex:1,overflow:'hidden' }} />

      {/* Modal GitHub */}
      {showGH && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,padding:16 }}>
          <div style={{ background:'#111',border:'1px solid #2a2a2a',borderRadius:16,padding:28,width:'100%',maxWidth:480 }}>
            <h3 style={{ color:'#fff',fontSize:18,fontWeight:700,margin:'0 0 4px' }}>Configurações GitHub</h3>
            <p style={{ color:'#666',fontSize:13,margin:'0 0 24px' }}>Defina onde o site será publicado ao clicar em "Publicar".</p>
            <form onSubmit={handleSaveGH}>
              {[['Repositório','usuario/repositorio','github_repo','usuario/meu-site'],['Arquivo','index.html','github_path','index.html'],['Branch','main ou gh-pages','github_branch','main']].map(([l,h,k,p]) => (
                <div key={k} style={{ marginBottom:16 }}>
                  <label style={{ display:'block',color:'#ccc',fontSize:13,marginBottom:4 }}>{l} <span style={{ color:'#555',fontSize:12 }}>({h})</span></label>
                  <input value={ghForm[k]} onChange={e => setGhForm(f => ({ ...f, [k]: e.target.value }))} placeholder={p} style={{ width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ display:'flex',gap:12,marginTop:8 }}>
                <button type="button" onClick={() => setShowGH(false)} style={{ flex:1,padding:'11px 0',borderRadius:10,border:'1px solid #2a2a2a',background:'transparent',color:'#aaa',cursor:'pointer',fontSize:14 }}>Cancelar</button>
                <button type="submit" disabled={savingGH} style={{ flex:1,padding:'11px 0',borderRadius:10,background:savingGH?'#555':'#E8922A',color:'#000',fontWeight:700,cursor:'pointer',border:'none',fontSize:14 }}>{savingGH?'Salvando…':'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TBtn({ onClick, label, title }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:8,border:'1px solid #2a2a2a',background:h?'#1e1e1e':'transparent',color:h?'#fff':'#aaa',fontSize:13,cursor:'pointer',whiteSpace:'nowrap' }}>
      {label}
    </button>
  )
}
