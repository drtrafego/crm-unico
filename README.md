# CRM ÚNICO — SaaS Multi-tenant

CRM moderno e multi-tenant para gestão de leads com visualização **Kanban**, **Lista** e **Analytics**. Integração nativa com Meta Ads (WhatsApp + Instagram Direct), Google Ads, Hotmart e webhooks genéricos.

## 🚀 Features

### Core CRM
- **Multi-tenant:** Isolamento total de dados por organização
- **Kanban Board:** Drag-and-drop com colunas customizáveis
- **Lista de Leads:** Tabela com busca, filtros e paginação
- **Analytics Dashboard:** Métricas, gráficos e KPIs em tempo real
- **Calendário:** Visualização de follow-ups por data
- **Histórico do Lead:** Tracking automático de movimentações

### Integrações
- **Meta Messaging:** Captura automática de leads via WhatsApp (WABA + Business Number) e Instagram Direct
- **Webhooks Genéricos:** Recebe leads de qualquer fonte (Zapier, n8n, Typeform, WordPress, etc.)
- **Hotmart:** Webhook para vendas com mapeamento por produto
- **AI Normalization:** OpenAI normaliza dados desestruturados automaticamente

### Fontes de Lead (com ícones)
- **Google** — ícone multicolor do Google
- **Meta** — infinito azul oficial
- **WhatsApp** — ícone verde (campanhas click-to-WhatsApp)
- **Direct** — ícone Instagram (campanhas click-to-DM)
- **ChatGPT** — ícone OpenAI (leads vindos do ChatGPT)
- **Claude** — ícone Anthropic
- **Gemini** — ícone Google AI
- **Grok** — ícone X/xAI
- **AI Search** — genérico (Copilot, Perplexity, etc.)
- **Captação Ativa** — prospecção manual
- **Orgânicos** — SEO/tráfego orgânico

### Segurança
- **Autenticação:** Stack Auth com proteção em todas as rotas
- **Autorização:** Roles (owner/admin/editor/viewer) por organização
- **Data Isolation:** Queries sempre filtram por organizationId
- **Webhook Validation:** Hottok (Hotmart), verify_token (Meta)
- **Endpoints protegidos:** Debug/fix desativados em produção

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Database:** Neon (Serverless PostgreSQL)
- **ORM:** Drizzle ORM
- **Authentication:** Stack Auth
- **AI:** OpenAI SDK
- **Package Manager:** pnpm
- **Deploy:** Vercel

## 📦 Estrutura do Projeto

```
src/
├── app/
│   ├── (authenticated)/         # Rotas protegidas
│   │   ├── adm/                 # Super Admin Dashboard
│   │   └── org/[orgSlug]/       # Rotas por organização
│   │       ├── kanban/          # Kanban + Lista (?view=list)
│   │       ├── analytics/       # Dashboard de métricas
│   │       ├── settings/        # Configurações + Meta Integration
│   │       └── launch-leads/    # Lançamento (condicional)
│   ├── api/
│   │   └── webhooks/
│   │       ├── [orgSlug]/       # Webhook genérico (Zapier, n8n, etc.)
│   │       ├── meta-messaging/  # WhatsApp + Instagram Direct
│   │       │   └── [orgSlug]/   # Roteamento por slug ou "router"
│   │       └── hotmart/         # Vendas Hotmart
│   └── login/                   # Página pública de login
├── components/
│   ├── features/
│   │   ├── kanban/              # Board, Column, LeadCard, Dialogs
│   │   └── crm/                 # LeadsList, Analytics, Calendar
│   ├── layout/                  # Sidebar, MainLayout
│   └── ui/                      # Componentes shadcn/ui
├── lib/                         # Utils, DB, Auth helpers
│   └── leads-helper.ts          # Normalização de fontes (Google, Meta, IAs...)
├── server/
│   ├── actions/                 # Server Actions (leads, settings, meta-integrations)
│   └── db/
│       └── schema.ts            # Schema Drizzle (leads, columns, metaIntegrations, etc.)
```

## ⚡ Setup

### 1. Clone & Install
```bash
git clone https://github.com/drtrafego/crm-unico.git
cd crm-unico
pnpm install
```

### 2. Environment Variables
Criar `.env.local`:
```env
# Database (Neon)
DATABASE_URL="postgresql://..."

# Auth (Stack Auth)
NEXT_PUBLIC_STACK_PROJECT_ID="..."
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY="..."
STACK_SECRET_SERVER_KEY="..."

# AI (OpenAI)
OPENAI_API_KEY="sk-..."

# Meta (WhatsApp/Instagram webhooks)
META_WEBHOOK_VERIFY_TOKEN="crm_meta_verify_2024"
META_ACCESS_TOKEN="..."

# Hotmart
HOTMART_HOTTOK="..."

# Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"
```

### 3. Database
```bash
pnpm run db:push
```

### 4. Dev Server
```bash
pnpm dev
```

## 🔌 Webhooks

### Genérico (Zapier, n8n, forms)
```
POST https://[DOMAIN]/api/webhooks/[ORG-SLUG]
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@empresa.com",
  "whatsapp": "5511999999999",
  "company": "Empresa X",
  "message": "Quero saber mais"
}
```

### Meta Messaging (WhatsApp + Instagram)
```
Callback URL: https://[DOMAIN]/api/webhooks/meta-messaging/router
Verify Token: META_WEBHOOK_VERIFY_TOKEN
```
O roteamento é automático via tabela `meta_integrations` (configurado nas Settings de cada org).

### Hotmart
```
POST https://[DOMAIN]/api/webhooks/hotmart
Header: x-hotmart-hottok: [HOTMART_HOTTOK]
```

## 📜 License

Proprietary software — DR.TRAFEGO.
