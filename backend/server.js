// server.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const { extractFromUrl, extractFromText } = require('./extractor')
const { extractTextFromFigma }            = require('./figma')
const { reviewText }                      = require('./reviewer')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.static(path.join(__dirname, '../frontend')))

// ─────────────────────────────────────────────
// ROTA PRINCIPAL: POST /review
// ─────────────────────────────────────────────

app.post('/review', async (req, res) => {
  const { link, tipo, produto, textoManual } = req.body

  if (!link && !textoManual) {
    return res.status(400).json({ success: false, error: 'Informe um link ou cole o texto manualmente.' })
  }
  if (!tipo) {
    return res.status(400).json({ success: false, error: 'Selecione o tipo de revisão.' })
  }

  try {
    let extractResult

    if (textoManual && textoManual.trim().length > 0) {
      // Texto manual — sem screenshot
      extractResult = extractFromText(textoManual)

    } else if (link.includes('figma.com')) {
      // Figma — só texto via API
      console.log(`[Figma] Extraindo de: ${link}`)
      const figmaResult = await extractTextFromFigma(link)
      extractResult = { ...figmaResult, screenshot: null }

    } else {
      // Página web — Puppeteer (texto + screenshot)
      console.log(`[Web] Abrindo com Puppeteer: ${link}`)
      extractResult = await extractFromUrl(link)
    }

    if (!extractResult.success) {
      return res.status(400).json({ success: false, error: extractResult.error })
    }

    console.log(`[Revisão] Tipo: ${tipo} | Chars: ${extractResult.charCount} | Screenshot: ${extractResult.screenshot ? 'sim' : 'não'}`)

    const reviewResult = await reviewText(
      extractResult.text,
      tipo,
      produto,
      extractResult.screenshot
    )

    return res.json({
      success: true,
      report:  reviewResult.report,
      meta: {
        link:       link || 'Texto manual',
        tipo,
        produto:    produto || 'Não informado',
        charCount:  extractResult.charCount,
        tokensUsed: reviewResult.tokensUsed,
        model:      reviewResult.model,
        usedVision: reviewResult.usedVision,
        timestamp:  new Date().toLocaleString('pt-BR')
      }
    })

  } catch (error) {
    console.error('[Erro]', error.message)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// ─── GET /api/settings ────────────────────────
app.get('/api/settings', (req, res) => {
  const key        = process.env.ANTHROPIC_API_KEY || ''
  const configured = key.length > 10
  const masked     = configured ? key.slice(0, 14) + '...' + key.slice(-4) : ''
  res.json({ configured, masked })
})

// ─── POST /api/settings ───────────────────────
app.post('/api/settings', (req, res) => {
  const { anthropic_api_key, figma_token } = req.body

  if (anthropic_api_key) process.env.ANTHROPIC_API_KEY = anthropic_api_key
  if (figma_token)       process.env.FIGMA_TOKEN       = figma_token

  const envPath = path.join(__dirname, '../.env')
  let content   = ''
  try { content = fs.readFileSync(envPath, 'utf8') } catch {}

  if (anthropic_api_key) {
    content = content.includes('ANTHROPIC_API_KEY=')
      ? content.replace(/ANTHROPIC_API_KEY=.*/m, `ANTHROPIC_API_KEY=${anthropic_api_key}`)
      : content + `\nANTHROPIC_API_KEY=${anthropic_api_key}`
  }
  if (figma_token) {
    content = content.includes('FIGMA_TOKEN=')
      ? content.replace(/FIGMA_TOKEN=.*/m, `FIGMA_TOKEN=${figma_token}`)
      : content + `\nFIGMA_TOKEN=${figma_token}`
  }

  fs.writeFileSync(envPath, content)
  res.json({ ok: true })
})

// ─── Health check ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`\n✅ XMX Review Funnel rodando em: http://localhost:${PORT}`)
  console.log(`📋 Interface: http://localhost:${PORT}/index.html`)
  console.log(`🖼  Puppeteer ativo — análise visual habilitada\n`)
})
