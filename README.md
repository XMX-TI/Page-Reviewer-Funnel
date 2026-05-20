# XMX Page Reviewer

Agente de revisão técnica de páginas de funil direto.

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Edite o `.env` e adicione sua chave da API Anthropic:
```
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
FIGMA_TOKEN=figd_seu-token-aqui  # opcional, para revisão Figma
```

## Rodar

```bash
npm start
```

Acesse: http://localhost:3000

## Tipos de Revisão

### Revisões Técnicas de Copy
- **Grafia e Concordância** — erros de escrita e gramática
- **Separadores Numéricos** — formatação de preços e números (padrão US)
- **Congruência de Produto** — nome, ingredientes, referências erradas
- **Linguagem de Garantia** — linguagem não-aprovada de garantia
- **Compliance FTC/FDA** — claims proibidos por regulação
- **Negative Opt-out** — linguagem manipulativa de recusa
- **Copyright e Símbolos** — © ™ ® corretos
- **Revisão Completa Copy** — tudo acima em uma só revisão

### Revisão de Funil
- **Revisão Figma** — verifica kits, preços, flags e layout no Figma
- **Revisão de Página** — verifica kits, preços, flags, countdown nas DTCs
- **Revisão de Upsell** — verifica preços totais ($179/bottle), selos de desconto, garantia, link de recusa

### Revisão Completa
- **Revisão Completa** — tudo: copy + kits + upsell + countdown
