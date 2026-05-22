// reviewer.js
const Anthropic = require('@anthropic-ai/sdk')
const prompts   = require('./prompts')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HAIKU_TYPES = [
  'grafia', 'separadores', 'congruencia', 'garantia',
  'compliance', 'optout', 'copyright', 'completa_copy', 'completa', 'figma'
]

const SONNET_VISION_TYPES = [
  'figma_funil', 'page_funil', 'upsell', 'completa_total'
]

const PRODUTO_TYPES = ['congruencia', 'completa', 'completa_copy', 'completa_total']

async function reviewText(text, tipo, produto, screenshot = null) {
  let systemPrompt
  if (PRODUTO_TYPES.includes(tipo)) {
    systemPrompt = typeof prompts[tipo] === 'function' ? prompts[tipo](produto) : prompts[tipo]
  } else {
    systemPrompt = prompts[tipo]
  }

  if (!systemPrompt) throw new Error(`Tipo de revisão inválido: ${tipo}`)

  const useVision = SONNET_VISION_TYPES.includes(tipo) && screenshot
  const model = SONNET_VISION_TYPES.includes(tipo)
    ? 'claude-sonnet-4-5'
    : 'claude-haiku-4-5-20251001'

  let messageContent

  if (useVision && screenshot) {
    console.log(`[Reviewer] Visão ativa — modelo: ${model}`)
    messageContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: screenshot }
      },
      {
        type: 'text',
        text: `Screenshot do design para análise visual.\n\nTexto extraído para verificação de valores:\n\n${text}`
      }
    ]
  } else {
    console.log(`[Reviewer] Só texto — modelo: ${model}`)
    messageContent = `Revise o seguinte conteúdo:\n\n${text}`
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }]
    })

    return {
      success: true,
      report: response.content[0]?.text || 'Sem resposta.',
      tokensUsed: {
        input:  response.usage?.input_tokens  || 0,
        output: response.usage?.output_tokens || 0,
        total:  (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      model,
      usedVision: useVision
    }
  } catch (error) {
    if (error.status === 401) throw new Error('Chave da API Anthropic inválida.')
    if (error.status === 429) throw new Error('Limite de requisições atingido. Aguarde alguns segundos.')
    throw new Error(`Erro na API Anthropic: ${error.message}`)
  }
}

module.exports = { reviewText }
