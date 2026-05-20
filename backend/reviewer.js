// reviewer.js
// Monta o prompt e chama a API da Anthropic
// Revisões de funil usam Sonnet com visão (texto + screenshot)
// Revisões de copy usam Haiku (só texto, mais barato)

const Anthropic = require('@anthropic-ai/sdk')
const prompts   = require('./prompts')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Tipos que usam HAIKU — só texto, revisões técnicas de copy
const HAIKU_TYPES = [
  'grafia', 'separadores', 'congruencia', 'garantia',
  'compliance', 'optout', 'copyright', 'completa_copy', 'completa', 'figma'
]

// Tipos que usam SONNET com visão — recebem texto + screenshot
const SONNET_VISION_TYPES = [
  'figma_funil', 'page_funil', 'upsell', 'completa_total'
]

// Tipos que recebem o produto como parâmetro
const PRODUTO_TYPES = ['congruencia', 'completa', 'completa_copy', 'completa_total']

async function reviewText(text, tipo, produto, screenshot = null) {

  // Seleciona o system prompt
  let systemPrompt
  if (PRODUTO_TYPES.includes(tipo)) {
    systemPrompt = typeof prompts[tipo] === 'function' ? prompts[tipo](produto) : prompts[tipo]
  } else {
    systemPrompt = prompts[tipo]
  }

  if (!systemPrompt) throw new Error(`Tipo de revisão inválido: ${tipo}`)

  // Seleciona o modelo
  const useVision = SONNET_VISION_TYPES.includes(tipo) && screenshot
  const model = (SONNET_VISION_TYPES.includes(tipo))
    ? 'claude-sonnet-4-5'
    : 'claude-haiku-4-5-20251001'

  // Monta o conteúdo da mensagem
  let messageContent

  if (useVision && screenshot) {
    // Manda screenshot + texto para o Sonnet analisar visualmente
    console.log(`[Reviewer] Usando visão — modelo: ${model}`)
    messageContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: screenshot
        }
      },
      {
        type: 'text',
        text: `Aqui está o screenshot completo da página para análise visual.\n\nAbaixo está também o texto extraído da página para verificação dos valores:\n\n${text}`
      }
    ]
  } else {
    // Só texto
    console.log(`[Reviewer] Só texto — modelo: ${model}`)
    messageContent = `Revise o seguinte texto:\n\n${text}`
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }]
    })

    const result = response.content[0]?.text || 'Sem resposta da API.'

    return {
      success: true,
      report: result,
      tokensUsed: {
        input:  response.usage?.input_tokens  || 0,
        output: response.usage?.output_tokens || 0,
        total:  (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      model,
      usedVision: useVision
    }

  } catch (error) {
    if (error.status === 401) throw new Error('Chave da API Anthropic inválida. Verifique o arquivo .env')
    if (error.status === 429) throw new Error('Limite de requisições atingido. Aguarde alguns segundos.')
    throw new Error(`Erro na API Anthropic: ${error.message}`)
  }
}

module.exports = { reviewText }
