// figma.js
// Extrai todos os textos de um arquivo Figma via API REST
// Percorre os nós recursivamente e coleta apenas nós do tipo TEXT

const axios = require('axios')

function extractFileKey(figmaUrl) {
  try {
    const url   = new URL(figmaUrl)
    const parts = url.pathname.split('/')

    const fileIndex = parts.indexOf('file')
    if (fileIndex !== -1 && parts[fileIndex + 1]) {
      return parts[fileIndex + 1]
    }

    const designIndex = parts.indexOf('design')
    if (designIndex !== -1 && parts[designIndex + 1]) {
      return parts[designIndex + 1]
    }

    return null
  } catch {
    return null
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
    return { success: false, error: 'Token do Figma não configurado no arquivo .env' }
  }

  const fileKey = extractFileKey(figmaUrl)
  if (!fileKey) {
    return { success: false, error: 'Não foi possível extrair o file_key da URL do Figma. Verifique o link.' }
  }

  try {
    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      timeout: 30000,
      headers: { 'X-Figma-Token': token }
    })

    const document = response.data.document
    const texts    = collectTextNodes(document)

    if (texts.length === 0) {
      return { success: false, error: 'Nenhum texto encontrado no arquivo Figma. Verifique se o link tem acesso público.' }
    }

    let combined = texts.join('\n')
    if (combined.length > 8000) {
      combined = combined.substring(0, 8000) + '\n\n[... texto truncado ...]'
    }

    return { success: true, text: combined, charCount: combined.length, totalTexts: texts.length }

  } catch (error) {
    if (error.response?.status === 403) {
      return { success: false, error: 'Acesso negado ao Figma. Verifique se o arquivo é público ou se o token está correto.' }
    }
    if (error.response?.status === 404) {
      return { success: false, error: 'Arquivo Figma não encontrado. Verifique o link.' }
    }
    return { success: false, error: `Erro ao acessar o Figma: ${error.message}` }
  }
}

module.exports = { extractTextFromFigma }
