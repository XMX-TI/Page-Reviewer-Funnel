# XMX Page Reviewer

> Agente de revisão técnica de páginas de funil direto, usando IA (Anthropic) para revisar copy, kits, preços e compliance.

---

## Sobre

O usuário cola um link (página web ou arquivo Figma) ou o texto manualmente, escolhe o tipo de revisão e o produto, e recebe um relatório em português com os problemas encontrados. O backend extrai o conteúdo (via scraping da URL, Puppeteer/Figma API, ou texto colado), envia para a API da Anthropic com o prompt correspondente ao tipo de revisão escolhido, e devolve o relatório para o frontend.

Tipos de revisão disponíveis:

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

<!-- PENDENTE: confirmar para qual time/área este sistema é usado internamente (ex.: time de copy, marketing, compliance?) -->

**Status:** em produção — deploy automático via Coolify configurado em `.github/workflows/coolify-redeploy.yml`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js <!-- PENDENTE: versão mínima não especificada no package.json (sem campo "engines") --> |
| Framework | Express 4 |
| Banco de dados | Nenhum |
| Extração de conteúdo | Cheerio (HTML), Puppeteer (renderização/screenshot), Axios |
| IA | @anthropic-ai/sdk |
| Outros | dotenv, cors, nodemon (dev) |

---

## Pré-requisitos

Antes de começar, você precisa ter instalado:

- Node.js <!-- PENDENTE: versão mínima não especificada no projeto -->
- npm (o projeto usa `package-lock.json`)
- Uma chave de API da **Anthropic**
- Um token pessoal do **Figma** (opcional — só necessário para revisão de arquivos Figma)

---

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/XMX-TI/Page-Reviewer-Funnel.git
cd Page-Reviewer-Funnel

# 2. Instale as dependências
npm install

# 3. Crie o arquivo de ambiente a partir do exemplo
cp .env.example .env

# 4. Preencha o .env com os valores reais (veja a seção abaixo)
```

---

## Variáveis de ambiente

O arquivo `.env` **não é versionado**. Copie o `.env.example` e preencha os valores.

| Variável | Obrigatória | Descrição | Onde obter |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Chave da API da Anthropic, usada para gerar os relatórios de revisão | <!-- PENDENTE: confirmar onde obter (ex.: console da Anthropic) --> |
| `FIGMA_TOKEN` | Não | Token pessoal do Figma, necessário apenas para revisão de arquivos Figma | <!-- PENDENTE: confirmar onde obter (ex.: Figma > Account Settings > Personal Access Tokens) --> |
| `PORT` | Não | Porta em que o servidor sobe | Padrão: `3000` |

---

## Executando localmente

```bash
# Modo produção
npm start

# Modo desenvolvimento (reinício automático com nodemon)
npm run dev
```

O sistema ficará disponível em **http://localhost:3000**.

### Verificando se funcionou

Acesse `http://localhost:3000/health` — deve retornar `{"status":"ok"}`.
A interface principal fica em `http://localhost:3000`.

---

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` | Inicia o servidor (`node backend/server.js`) |
| `npm run dev` | Inicia o servidor em modo desenvolvimento com `nodemon` |

---

## Estrutura do projeto

```
Page-Reviewer-Funnel/
├── backend/
│   ├── server.js      # Servidor Express (ponto de entrada, rotas /review, /health, /api/settings)
│   ├── extractor.js   # Extrai texto de páginas web
│   ├── figma.js        # Extrai textos/screenshots do Figma via API
│   ├── reviewer.js     # Chama a API da Anthropic
│   └── prompts.js      # System prompts de cada tipo de revisão
├── frontend/
│   ├── index.html      # Interface web (formulário + resultado)
│   ├── style.css        # Estilos da interface (compilado a partir de style.scss)
│   ├── style.scss      # Fonte dos estilos
│   └── app.js           # Lógica do frontend (fetch, exibição do relatório)
├── .github/workflows/
│   └── coolify-redeploy.yml   # Dispara redeploy no Coolify a cada push/merge em main
├── .env.example
├── .gitignore
└── README.md
```

---

## Problemas comuns

| Erro | Causa provável | Solução |
|---|---|---|

---

## Deploy

Deploy automático via **Coolify**. O workflow `.github/workflows/coolify-redeploy.yml` dispara o redeploy a cada push ou pull request mergeado na branch `main`, chamando o webhook configurado no secret do GitHub `COOLIFY_DEPLOY_WEBHOOK`.

---

## Responsáveis

| Papel | Pessoa | Contato |
|---|---|---|
| <!-- PENDENTE: confirmar papel --> | Pedro | pedro.vamelotti@gmail.com |
| <!-- PENDENTE: confirmar papel --> | FN-corp | funil@xmxcorp.com |

<!-- PENDENTE: lista de responsáveis acima foi inferida dos autores no histórico do git — confirme se está correta e atualizada -->

---

**Última atualização:** 18/08/2026
