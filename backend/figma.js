// figma.js
// Extrai texto via API do Figma + screenshot via Puppeteer
// O Puppeteer abre o link público do Figma e tira screenshot dos frames

const axios     = require('axios')
const puppeteer = require('puppeteer')

const MAX_CHARS      = 12000
const MAX_IMG_HEIGHT = 7800

function extractFileKeyAndNodeId(figmaUrl) {
  try {
    const url   = new URL(figmaUrl)
    const parts = url.pathname.split('/')
    let fileKey = null
    const fileIndex   = parts.indexOf('file')
    const designIndex = parts.indexOf('design')
    if (fileIndex !== -1 && parts[fileIndex + 1])        fileKey = parts[fileIndex + 1]
    else if (designIndex !== -1 && parts[designIndex + 1]) fileKey = parts[designIndex + 1]
    const nodeId = url.searchParams.get('node-id') || null
    return { fileKey, nodeId }
  } catch {
    return { fileKey: null, nodeId: null }
  }
}

function collectTextNodes(node, texts = []) {
  if (node.type === 'TEXT' && node.characters) {
    const text = node.characters.trim()
    if (text.length > 0) texts.push(text)
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) collectTextNodes(child, texts)
  }
  return texts
}

async function screenshotFigmaWithPuppeteer(figmaUrl) {
  let browser = null
  try {
    console.log(`[Figma/Puppeteer] Abrindo: ${figmaUrl}`)

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Open Figma URL
    await page.goto(figmaUrl, { waitUntil: 'networkidle2', timeout: 60000 })

    // Wait for Figma canvas to load
    await new Promise(r => setTimeout(r, 8000))

    // Try to dismiss any login/cookie popups
    try {
      await page.keyboard.press('Escape')
      await new Promise(r => setTimeout(r, 1000))
    } catch {}

    // Take screenshot of whatever is visible
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const clipHeight  = Math.min(pageHeight, MAX_IMG_HEIGHT)

    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: 1920, height: clipHeight },
      type: 'jpeg',
      quality: 80
    })

    console.log(`[Figma/Puppeteer] Screenshot: ${Math.round(buf.length / 1024)}KB`)
    return buf.toString('base64')

  } catch (error) {
    console.warn(`[Figma/Puppeteer] Falha: ${error.message}`)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

async function extractTextFromFigma(figmaUrl) {
  const token = process.env.FIGMA_TOKEN

  const { fileKey, nodeId } = extractFileKeyAndNodeId(figmaUrl)

  if (!fileKey) {
    return { success: false, error: 'Não foi possível extrair o file_key da URL do Figma. Verifique o link.' }
  }

  try {
    // STEP 1: Extract structured text via API (if token available)
    let structuredText = ''
    let totalTexts     = 0

    if (token && token !== 'figd_coloque-seu-token-aqui') {
      console.log(`[Figma] Extraindo texto via API: ${fileKey}`)

      const fileRes = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
        timeout: 30000,
        headers: { 'X-Figma-Token': token }
      })

      const document = fileRes.data.document
      const fileName = fileRes.data.name || 'Figma'
      const firstPage = document.children?.[0]

      structuredText = `Arquivo: ${fileName}\n\n`

      if (firstPage?.children?.length > 0) {
        for (const frame of firstPage.children) {
          const frameTexts = collectTextNodes(frame)
          if (frameTexts.length > 0) {
            structuredText += `=== ${frame.name} ===\n${frameTexts.join('\n')}\n\n`
          }
        }
      } else {
        const allTexts = collectTextNodes(document)
        structuredText += allTexts.join('\n')
      }

      totalTexts = collectTextNodes(document).length
      console.log(`[Figma] Texto: ${structuredText.length} chars, ${totalTexts} nós`)
    } else {
      console.log(`[Figma] Sem token — usando só screenshot`)
      structuredText = 'Texto extraído via análise visual do Figma.'
    }

    if (structuredText.length > MAX_CHARS) {
      structuredText = structuredText.substring(0, MAX_CHARS) + '\n\n[... truncado ...]'
    }

    // STEP 2: Screenshot via Puppeteer
    console.log(`[Figma] Capturando screenshot via Puppeteer...`)
    const screenshotBase64 = await screenshotFigmaWithPuppeteer(figmaUrl)

    if (!screenshotBase64 && totalTexts === 0) {
      return { success: false, error: 'Não foi possível acessar o arquivo Figma. Verifique se o link é público.' }
    }

    console.log(`[Figma] ✅ Pronto — imagem: ${screenshotBase64 ? 'sim' : 'não'} | texto: ${structuredText.length} chars`)

    return {
      success:    true,
      text:       structuredText,
      screenshot: screenshotBase64,
      charCount:  structuredText.length,
      totalTexts,
      hasImage:   !!screenshotBase64
    }

  } catch (error) {
    console.error(`[Figma] Erro:`, error.response?.status, error.message)
    if (error.response?.status === 403)
      return { success: false, error: 'Acesso negado ao Figma. Verifique se o arquivo é público.' }
    if (error.response?.status === 404)
      return { success: false, error: 'Arquivo Figma não encontrado. Verifique o link.' }
    return { success: false, error: `Erro ao acessar o Figma: ${error.message}` }
  }
}

module.exports = { extractTextFromFigma }
