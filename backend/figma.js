// figma.js
// Extrai texto E imagem de um arquivo Figma via API REST
// A imagem é gerada pela API do Figma e enviada para o Claude analisar visualmente

const axios = require('axios')

function extractFileKeyAndNodeId(figmaUrl) {
  try {
    const url   = new URL(figmaUrl)
    const parts = url.pathname.split('/')

    let fileKey = null
    const fileIndex   = parts.indexOf('file')
    const designIndex = parts.indexOf('design')

    if (fileIndex !== -1 && parts[fileIndex + 1]) {
      fileKey = parts[fileIndex + 1]
    } else if (designIndex !== -1 && parts[designIndex + 1]) {
      fileKey = parts[designIndex + 1]
    }

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
    for (const child of node.children) {
      collectTextNodes(child, texts)
    }
  }
  return texts
}

async function extractTextFromFigma(figmaUrl) {
  const token = process.env.FIGMA_TOKEN

  if (!token || token === 'figd_coloque-seu-token-aqui') {
    return { success: false, error: 'Token do Figma não configurado. Acesse Configurações e adicione seu token.' }
  }

  const { fileKey, nodeId } = extractFileKeyAndNodeId(figmaUrl)

  if (!fileKey) {
    return { success: false, error: 'Não foi possível extrair o file_key da URL do Figma. Verifique o link.' }
  }

  try {
    // STEP 1: Get text content from file
    const fileRes = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      timeout: 30000,
      headers: { 'X-Figma-Token': token }
    })

    const document = fileRes.data.document
    const texts    = collectTextNodes(document)
    let textContent = texts.join('\n')
    if (textContent.length > 12000) {
      textContent = textContent.substring(0, 12000) + '\n\n[... texto truncado ...]'
    }

    // STEP 2: Get image render from Figma API
    let screenshotBase64 = null

    try {
      let nodeIds = nodeId ? nodeId.replace('-', ':') : null

      if (!nodeIds) {
        const firstPage = document.children?.[0]
        if (firstPage?.children?.length > 0) {
          nodeIds = firstPage.children
            .slice(0, 4)
            .map(n => n.id)
            .join(',')
        }
      }

      if (nodeIds) {
        console.log(`[Figma] Gerando imagem para nodes: ${nodeIds}`)

        const imgRes = await axios.get(
          `https://api.figma.com/v1/images/${fileKey}`,
          {
            timeout: 30000,
            headers: { 'X-Figma-Token': token },
            params: { ids: nodeIds, format: 'jpg', scale: 1 }
          }
        )

        const imageUrls = imgRes.data.images || {}
        const firstUrl  = Object.values(imageUrls)[0]

        if (firstUrl) {
          console.log(`[Figma] Baixando imagem: ${firstUrl}`)
          const imgData = await axios.get(firstUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
          })
          screenshotBase64 = Buffer.from(imgData.data).toString('base64')
          console.log(`[Figma] Imagem: ${Math.round(imgData.data.byteLength / 1024)}KB`)
        }
      }
    } catch (imgError) {
      console.warn('[Figma] Aviso: imagem não disponível:', imgError.message)
    }

    if (texts.length === 0 && !screenshotBase64) {
      return { success: false, error: 'Nenhum conteúdo encontrado no arquivo Figma. Verifique se o link tem acesso.' }
    }

    return {
      success:    true,
      text:       textContent,
      screenshot: screenshotBase64,
      charCount:  textContent.length,
      totalTexts: texts.length
    }

  } catch (error) {
    if (error.response?.status === 403)
      return { success: false, error: 'Acesso negado ao Figma. Verifique se o arquivo é público ou se o token está correto.' }
    if (error.response?.status === 404)
      return { success: false, error: 'Arquivo Figma não encontrado. Verifique o link.' }
    return { success: false, error: `Erro ao acessar o Figma: ${error.message}` }
  }
}

module.exports = { extractTextFromFigma }
