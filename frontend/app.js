// app.js — XMX Review Funnel

// ─── DESCRIÇÕES DOS TIPOS ─────────────────────
const tipoDescricoes = {
  completa_copy:  '📝 Grafia e Concordância · 🔢 Separadores Numéricos · 🔄 Congruência de Produto · 🛡 Linguagem de Garantia · ⚠️ Compliance FTC/FDA · 🚫 Negative Opt-out · © Copyright e Símbolos de Marca',
  figma_funil:    '🎨 Verifica kits, preços, flags, sequência desktop/mobile e layout no Figma',
  page_funil:     '📄 Verifica kits, preços riscados, flags, countdown (10 min) e rótulo na página',
  upsell:         '🔼 Verifica preços riscados ($179/bottle), selos de desconto, day supply, garantia 60 dias e link de recusa',
  completa_total: '🚀 Revisão Completa Copy + Revisão Figma + Revisão de Página + Revisão de Upsell'
}

// ─── STATE ────────────────────────────────────
const state = { loading: false }

// ─── DOM REFS ─────────────────────────────────
const form          = document.getElementById('reviewForm')
const submitBtn     = document.getElementById('submitBtn')
const resultSection = document.getElementById('resultSection')
const errorSection  = document.getElementById('errorSection')
const reportContent = document.getElementById('reportContent')
const errorContent  = document.getElementById('errorContent')
const metaBar       = document.getElementById('metaBar')
const tokenInfo     = document.getElementById('tokenInfo')
const copyBtn       = document.getElementById('copyBtn')
const newReviewBtn  = document.getElementById('newReview')
const tryAgainBtn   = document.getElementById('tryAgain')
const openConfig    = document.getElementById('openConfig')
const closeConfig   = document.getElementById('closeConfig')
const configModal   = document.getElementById('configModal')
const saveConfig    = document.getElementById('saveConfig')
const apiKeyInput   = document.getElementById('apiKey')
const figmaTokenInput = document.getElementById('figmaToken')
const apiStatus     = document.getElementById('apiStatus')
const headerDate    = document.getElementById('headerDate')
const footerDate    = document.getElementById('footerDate')
const tipoSelect    = document.getElementById('tipo')
const tipoDesc      = document.getElementById('tipoDesc')

// ─── DATES ────────────────────────────────────
function formatDate() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
headerDate.textContent = formatDate()
footerDate.textContent = formatDate()

// ─── TIPO DESCRIPTION ─────────────────────────
tipoSelect.addEventListener('change', () => {
  const desc = tipoDescricoes[tipoSelect.value]
  if (desc) {
    tipoDesc.textContent = desc
    tipoDesc.classList.remove('hidden')
  } else {
    tipoDesc.classList.add('hidden')
  }
})

// ─── FORM SUBMIT ──────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (state.loading) return

  const link        = document.getElementById('link').value.trim()
  const textoManual = document.getElementById('textoManual').value.trim()
  const produto     = document.getElementById('produto').value.trim()
  const tipo        = tipoSelect.value

  if (!link && !textoManual) { showError('Informe um link ou cole o texto manualmente.'); return }
  if (!tipo)                 { showError('Selecione o tipo de revisão.'); return }

  setLoading(true)
  hideAll()

  try {
    const res = await fetch('/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link, textoManual, produto, tipo })
    })
    const data = await res.json()
    if (!data.success) { showError(data.error || 'Erro desconhecido.'); return }
    showResult(data)
  } catch (err) {
    showError('Não foi possível conectar ao servidor. Verifique se ele está rodando.')
  } finally {
    setLoading(false)
  }
})

// ─── SHOW RESULT ──────────────────────────────
function showResult(data) {
  const { report, meta } = data
  reportContent.textContent = report

  const tipoLabel  = getTipoLabel(meta.tipo)
  const visionTag  = meta.usedVision ? ' · 🖼 visão ativa' : ''
  metaBar.innerHTML = `
    <span>🔗 <strong>${escapeHtml(meta.link)}</strong></span>
    <span>📋 <strong>${tipoLabel}${visionTag}</strong></span>
    ${meta.produto && meta.produto !== 'Não informado' ? `<span>💊 <strong>${escapeHtml(meta.produto)}</strong></span>` : ''}
    <span>📅 <strong>${meta.timestamp}</strong></span>
    <span>📝 <strong>${meta.charCount} chars</strong></span>
  `

  if (meta.tokensUsed) {
    tokenInfo.textContent = `Tokens: ${meta.tokensUsed.input} entrada + ${meta.tokensUsed.output} saída = ${meta.tokensUsed.total} total · modelo: ${meta.model}`
  }

  resultSection.classList.remove('hidden')
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ─── SHOW ERROR ───────────────────────────────
function showError(msg) {
  errorContent.textContent = msg
  errorSection.classList.remove('hidden')
  errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function hideAll() {
  resultSection.classList.add('hidden')
  errorSection.classList.add('hidden')
}

// ─── LOADING ──────────────────────────────────
function setLoading(val) {
  state.loading = val
  if (val) {
    submitBtn.disabled = true
    submitBtn.innerHTML = 'Analisando<span class="loading-dots"><span></span><span></span><span></span></span>'
  } else {
    submitBtn.disabled = false
    submitBtn.textContent = 'Revisar Página'
  }
}

// ─── COPY ─────────────────────────────────────
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(reportContent.textContent).then(() => {
    const orig = copyBtn.textContent
    copyBtn.textContent = '✓ Copiado!'
    setTimeout(() => { copyBtn.textContent = orig }, 2000)
  })
})

// ─── NEW REVIEW ───────────────────────────────
newReviewBtn.addEventListener('click', () => {
  hideAll()
  form.reset()
  tipoDesc.classList.add('hidden')
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

tryAgainBtn.addEventListener('click', () => {
  hideAll()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

// ─── CONFIG MODAL ─────────────────────────────
openConfig.addEventListener('click', async () => {
  configModal.classList.remove('hidden')
  loadApiStatus()
})

closeConfig.addEventListener('click', () => configModal.classList.add('hidden'))
configModal.addEventListener('click', (e) => { if (e.target === configModal) configModal.classList.add('hidden') })

async function loadApiStatus() {
  try {
    const res  = await fetch('/api/settings')
    const data = await res.json()
    if (data.configured) {
      apiStatus.textContent = `✅ Chave configurada: ${data.masked}`
      apiStatus.style.color = 'var(--success)'
    } else {
      apiStatus.textContent = '⚠️ Chave não configurada'
      apiStatus.style.color = 'var(--warning)'
    }
  } catch {
    apiStatus.textContent = 'Servidor offline'
    apiStatus.style.color = 'var(--error)'
  }
}

saveConfig.addEventListener('click', async () => {
  const key   = apiKeyInput.value.trim()
  const figma = figmaTokenInput.value.trim()
  if (!key && !figma) return

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: key || undefined, figma_token: figma || undefined })
    })
    apiKeyInput.value   = ''
    figmaTokenInput.value = ''
    apiStatus.textContent = '✅ Configurações salvas!'
    apiStatus.style.color = 'var(--success)'
    setTimeout(() => configModal.classList.add('hidden'), 1200)
  } catch {
    apiStatus.textContent = '❌ Erro ao salvar. Servidor offline?'
    apiStatus.style.color = 'var(--error)'
  }
})

// ─── HELPERS ──────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getTipoLabel(tipo) {
  const map = {
    grafia:         'Grafia e Concordância',
    separadores:    'Separadores Numéricos',
    congruencia:    'Congruência de Produto',
    garantia:       'Linguagem de Garantia',
    compliance:     'Compliance FTC/FDA',
    optout:         'Negative Opt-out',
    copyright:      'Copyright e Símbolos de Marca',
    completa_copy:  'Revisão Completa Copy',
    figma_funil:    'Revisão Figma',
    page_funil:     'Revisão de Página (DTC/VSL/TSL)',
    upsell:         'Revisão de Upsell',
    completa_total: 'Revisão Completa',
    figma:          'Revisão Copy Figma',
    completa:       'Revisão Completa Copy (legado)',
  }
  return map[tipo] || tipo
}
