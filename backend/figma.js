// figma.js
// Extrai texto via API + screenshot via Puppeteer aguardando canvas do Figma

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
    if (fileIndex !== -1 && parts[fileIndex + 1])          fileKey = parts[fileIndex + 1]
    else if (designIndex !== -1 && parts[designIndex + 1]) fileKey = parts[designIndex + 1]
    const nodeId = url.searchParams.get('node-id') || null
    return { fileKey, nodeId }
  } catch {
    return { fileKey: null, nodeId: null }
  }
}

function collectTextNodes(node, texts = []) {
  if (node.type === 'TEXT' && node.characters) {
    const t = node.characters.trim()
    if (t.length > 0) texts.push(t)
  }
  if (node.children) for (const c of node.children) collectTextNodes(c, texts)
  return texts
}

async function screenshotFigmaWithPuppeteer(figmaUrl) {
  let browser = null
  try {
    console.log(`[Figma/Puppeteer] Iniciando...`)

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Use embed URL which renders without login
    const embedUrl = figmaUrl.replace('www.figma.com/design/', 'www.figma.com/embed?embed_host=share&url=https://www.figma.com/design/')
      .replace('www.figma.com/file/', 'www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/')

    console.log(`[Figma/Puppeteer] Abrindo embed: ${embedUrl.substring(0, 100)}...`)

    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 60000 })

    // Wait for canvas to render
    console.log(`[Figma/Puppeteer] Aguardando canvas renderizar...`)
    await new Promise(r => setTimeout(r, 15000))

    // Try to dismiss popups
    try { await page.keyboard.press('Escape') } catch {}
    await new Promise(r => setTimeout(r, 2000))

    // Check what loaded
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200))
    console.log(`[Figma/Puppeteer] Conteúdo da página: ${bodyText}`)

    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const clipHeight  = Math.min(pageHeight, MAX_IMG_HEIGHT)

    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: 1920, height: clipHeight },
      type: 'jpeg',
      quality: 85
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
  const { fileKey } = extractFileKeyAndNodeId(figmaUrl)

  if (!fileKey) {
    return { success: false, error: 'Não foi possível extrair o file_key da URL do Figma. Verifique o link.' }
  }

  // Run text extraction and screenshot in parallel
  const [textResult, screenshotBase64] = await Promise.all([
    // Text via API
    (async () => {
      if (!token || token === 'figd_coloque-seu-token-aqui') {
        return { text: '', totalTexts: 0 }
      }
      try {
        console.log(`[Figma] Extraindo texto via API...`)
        const fileRes = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
          timeout: 30000,
          headers: { 'X-Figma-Token': token }
        })
        const document  = fileRes.data.document
        const fileName  = fileRes.data.name || 'Figma'
        const firstPage = document.children?.[0]
        let structured  = `Arquivo: ${fileName}\n\n`

        if (firstPage?.children?.length > 0) {
          for (const frame of firstPage.children) {
            const frameTexts = collectTextNodes(frame)
            if (frameTexts.length > 0) {
              structured += `=== ${frame.name} ===\n${frameTexts.join('\n')}\n\n`
            }
          }
        } else {
          structured += collectTextNodes(document).join('\n')
        }

        if (structured.length > MAX_CHARS) structured = structured.substring(0, MAX_CHARS) + '\n\n[truncado]'
        const totalTexts = collectTextNodes(document).length
        console.log(`[Figma] Texto: ${structured.length} chars, ${totalTexts} nós`)
        return { text: structured, totalTexts }
      } catch (e) {
        console.warn(`[Figma] API falhou: ${e.message}`)
        return { text: '', totalTexts: 0 }
      }
    })(),

    // Screenshot via Puppeteer
    screenshotFigmaWithPuppeteer(figmaUrl)
  ])

  if (!textResult.text && !screenshotBase64) {
    return { success: false, error: 'Não foi possível acessar o arquivo Figma. Verifique se o link é público.' }
  }

  const finalText = textResult.text || 'Análise baseada na imagem visual do Figma.'

  console.log(`[Figma] ✅ Concluído — imagem: ${screenshotBase64 ? 'sim' : 'não'} | texto: ${finalText.length} chars`)

  return {
    success:    true,
    text:       finalText,
    screenshot: screenshotBase64,
    charCount:  finalText.length,
    totalTexts: textResult.totalTexts,
    hasImage:   !!screenshotBase64
  }
}

module.exports = { extractTextFromFigma }
