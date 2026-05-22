// extractor.js
const puppeteer = require('puppeteer')

const MAX_CHARS      = 12000
const MAX_IMG_HEIGHT = 7800

async function extractFromUrl(url) {
  let browser = null
  try {
    console.log(`[Puppeteer] Abrindo: ${url}`)
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1440,900']
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    const pageHeight = await page.evaluate(() => document.body.scrollHeight)
    const clipHeight = Math.min(pageHeight, MAX_IMG_HEIGHT)

    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: 1440, height: clipHeight },
      type: 'jpeg', quality: 75
    })
    const screenshotBase64 = buf.toString('base64')

    let text = await page.evaluate(() => {
      ['script','style','noscript','head','meta','link','svg','iframe'].forEach(tag =>
        document.querySelectorAll(tag).forEach(el => el.remove())
      )
      return document.body ? document.body.innerText : ''
    })
    text = text.replace(/\s+/g, ' ').trim()
    if (text.length > MAX_CHARS) text = text.substring(0, MAX_CHARS) + '\n\n[... truncado ...]'

    return { success: true, text, screenshot: screenshotBase64, charCount: text.length }
  } catch (error) {
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) return { success: false, error: 'Conexão recusada.' }
    if (error.message.includes('timeout')) return { success: false, error: 'Tempo esgotado.' }
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) return { success: false, error: 'Domínio não encontrado.' }
    return { success: false, error: `Erro: ${error.message}` }
  } finally {
    if (browser) await browser.close()
  }
}

function extractFromText(text) {
  const t = text.trim()
  return { success: true, text: t.length > MAX_CHARS ? t.substring(0, MAX_CHARS) + '\n\n[truncado]' : t, screenshot: null, charCount: t.length }
}

module.exports = { extractFromUrl, extractFromText }
