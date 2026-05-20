// extractor.js
// Extrai texto E screenshot de páginas web usando Puppeteer
// Screenshot é limitado a 7800px de altura para respeitar o limite da API Anthropic (8000px)

const puppeteer = require('puppeteer')

const MAX_CHARS      = 12000
const MAX_IMG_HEIGHT = 7800  // Anthropic limit is 8000px — stay safe

async function extractFromUrl(url) {
  let browser = null

  try {
    console.log(`[Puppeteer] Abrindo: ${url}`)

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    // Get full page height
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    console.log(`[Puppeteer] Altura da página: ${pageHeight}px`)

    let screenshotBase64

    if (pageHeight <= MAX_IMG_HEIGHT) {
      // Page fits — take full screenshot
      const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 75 })
      screenshotBase64 = buf.toString('base64')
      console.log(`[Puppeteer] Screenshot completo: ${Math.round(buf.length / 1024)}KB`)

    } else {
      // Page too tall — take multiple clips and use only the top section (kits area)
      // We take 3 clips: top, middle (kits), bottom
      const clips = []

      // Top section (0 to MAX/3)
      const topBuf = await page.screenshot({
        clip: { x: 0, y: 0, width: 1440, height: Math.min(MAX_IMG_HEIGHT, pageHeight) },
        type: 'jpeg',
        quality: 70
      })
      clips.push(topBuf.toString('base64'))

      // Use only the first clip — kits are usually in the top half
      screenshotBase64 = clips[0]
      console.log(`[Puppeteer] Página grande (${pageHeight}px), usando top ${Math.min(MAX_IMG_HEIGHT, pageHeight)}px`)
    }

    // Extract visible text
    let text = await page.evaluate(() => {
      const remove = ['script', 'style', 'noscript', 'head', 'meta', 'link', 'svg', 'iframe']
      remove.forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove())
      })
      return document.body ? document.body.innerText : ''
    })

    text = text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[... texto truncado ...]'
    }

    console.log(`[Puppeteer] Texto: ${text.length} chars`)

    return { success: true, text, screenshot: screenshotBase64, charCount: text.length }

  } catch (error) {
    console.error('[Puppeteer] Erro:', error.message)
    if (error.message.includes('net::ERR_CONNECTION_REFUSED'))
      return { success: false, error: 'Conexão recusada. A página pode estar offline.' }
    if (error.message.includes('TimeoutError') || error.message.includes('timeout'))
      return { success: false, error: 'Tempo de carregamento esgotado. A página demorou demais.' }
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED'))
      return { success: false, error: 'Domínio não encontrado. Verifique o link.' }
    return { success: false, error: `Erro ao acessar a página: ${error.message}` }

  } finally {
    if (browser) await browser.close()
  }
}

function extractFromText(text) {
  const trimmed = text.trim()
  return {
    success: true,
    text: trimmed.length > MAX_CHARS ? trimmed.substring(0, MAX_CHARS) + '\n\n[... truncado ...]' : trimmed,
    screenshot: null,
    charCount: trimmed.length
  }
}

module.exports = { extractFromUrl, extractFromText }
