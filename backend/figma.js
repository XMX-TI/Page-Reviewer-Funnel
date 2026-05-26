// figma.js
const axios = require('axios')
const MAX_CHARS = 12000

function extractFileKey(figmaUrl) {
  try {
    const url   = new URL(figmaUrl)
    const parts = url.pathname.split('/')
    const fileIndex   = parts.indexOf('file')
    const designIndex = parts.indexOf('design')
    if (fileIndex !== -1 && parts[fileIndex + 1])          return parts[fileIndex + 1]
    if (designIndex !== -1 && parts[designIndex + 1])      return parts[designIndex + 1]
    return null
  } catch { return null }
}

function collectTextNodes(node, texts = []) {
  if (node.type === 'TEXT' && node.characters) {
    const t = node.characters.trim()
    if (t.length > 0) texts.push(t)
  }
  if (node.children) for (const c of node.children) collectTextNodes(c, texts)
  return texts
}

async function downloadImage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
      return res.data
    } catch (e) {
      console.warn(`[Figma] Download tentativa ${i+1} falhou: ${e.message}`)
      if (i < retries - 1) await new Promise(r => setTimeout(r, 3000))
    }
  }
  return null
}

async function extractTextFromFigma(figmaUrl) {
  const token = process.env.FIGMA_TOKEN

  if (!token || token === 'figd_coloque-seu-token-aqui') {
    return { success: false, error: 'Token do Figma não configurado. Acesse Configurações e adicione seu token.' }
  }

  const fileKey = extractFileKey(figmaUrl)
  if (!fileKey) {
    return { success: false, error: 'Não foi possível extrair o file_key da URL do Figma.' }
  }

  try {
    console.log(`[Figma] Buscando arquivo: ${fileKey}`)
    const fileRes = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      timeout: 30000,
      headers: { 'X-Figma-Token': token }
    })

    const document  = fileRes.data.document
    const fileName  = fileRes.data.name || 'Figma'

    // Always use ALL top-level frames from the first page
    // regardless of node-id in the URL
    const firstPage = document.children?.[0]
    const topFrames = firstPage?.children || []

    console.log(`[Figma] Frames encontrados: ${topFrames.map(f => f.name).join(', ')}`)

    // Build structured text organized by frame
    let structured = `Arquivo: ${fileName}\n\n`
    for (const frame of topFrames) {
      const frameTexts = collectTextNodes(frame)
      if (frameTexts.length > 0) {
        structured += `=== ${frame.name} ===\n${frameTexts.join('\n')}\n\n`
      }
    }

    const totalTexts = collectTextNodes(document).length
    if (structured.length > MAX_CHARS) structured = structured.substring(0, MAX_CHARS) + '\n\n[truncado]'
    console.log(`[Figma] Texto: ${structured.length} chars, ${totalTexts} nós`)

    // Get images for ALL top frames
    let screenshotBase64 = null
    try {
      const renderIds = topFrames.slice(0, 6).map(f => f.id).join(',')
      console.log(`[Figma] Solicitando render para ${topFrames.slice(0,6).length} frames: ${topFrames.slice(0,6).map(f=>f.name).join(', ')}`)

      const imgRes = await axios.get(
        `https://api.figma.com/v1/images/${fileKey}`,
        {
          timeout: 60000,
          headers: { 'X-Figma-Token': token },
          params: { ids: renderIds, format: 'jpg', scale: 0.3 }
        }
      )

      const images = imgRes.data.images || {}
      console.log(`[Figma] URLs recebidas: ${Object.keys(images).length}`)

      const buffers = []
      for (const [id, url] of Object.entries(images)) {
        if (!url) continue
        const frameName = topFrames.find(f => f.id === id)?.name || id
        console.log(`[Figma] Baixando frame "${frameName}"...`)
        const buf = await downloadImage(url)
        if (buf) {
          console.log(`[Figma] "${frameName}": ${Math.round(buf.byteLength/1024)}KB`)
          buffers.push(buf)
        }
      }

      if (buffers.length > 0) {
        const largest = buffers.reduce((a, b) => a.byteLength > b.byteLength ? a : b)
        const sizeKB  = Math.round(largest.byteLength / 1024)
        if (largest.byteLength < 4 * 1024 * 1024) {
          screenshotBase64 = Buffer.from(largest).toString('base64')
          console.log(`[Figma] ✅ Imagem pronta: ${sizeKB}KB`)
        } else {
          console.warn(`[Figma] Imagem muito grande: ${sizeKB}KB`)
        }
      }
    } catch (imgErr) {
      console.warn(`[Figma] Falha na imagem: ${imgErr.response?.status} ${imgErr.message}`)
    }

    if (totalTexts === 0 && !screenshotBase64) {
      return { success: false, error: 'Nenhum conteúdo encontrado no arquivo Figma.' }
    }

    console.log(`[Figma] ✅ Concluído — imagem: ${screenshotBase64 ? 'sim' : 'não'} | texto: ${structured.length} chars`)

    return {
      success:    true,
      text:       structured,
      screenshot: screenshotBase64,
      charCount:  structured.length,
      totalTexts,
      hasImage:   !!screenshotBase64
    }

  } catch (error) {
    console.error(`[Figma] Erro: ${error.response?.status} ${error.message}`)
    if (error.response?.status === 403) return { success: false, error: 'Acesso negado. Verifique se o arquivo é público e o token está correto.' }
    if (error.response?.status === 404) return { success: false, error: 'Arquivo não encontrado. Verifique o link.' }
    return { success: false, error: `Erro ao acessar o Figma: ${error.message}` }
  }
}

module.exports = { extractTextFromFigma }
