# CRM SaaS B2B (Kanban Edition)

A modern, multi-tenant B2B CRM for lead management with a focus on a **Kanban Board** visualization. Built to provide a "Clean SaaS" experience with optimistic UI updates, customizable workflows, and AI integration.

![CRM Preview](https://placehold.co/800x400?text=CRM+Preview)

## 🚀 Features

### Core CRM
- **Multi-tenant Architecture:** Organization-based data isolation.
- **Kanban Board:** Drag-and-drop columns and cards with optimistic UI updates using `@dnd-kit`.
- **List View:** Tabular data display with filtering and sorting.
- **Lead Management:** Create, Edit, Move, and Delete leads.
- **Lead History:** Automatic tracking of all lead movements and updates.
- **Statistics:** Real-time stats for Total Leads, New Leads, Pipeline Value, and Won Revenue.

### Integrations & AI
- **Smart Webhooks:** Endpoint to receive leads from any form (WordPress, Typeform, etc).
- **AI Normalization:** OpenAI (GPT-4o-mini) processes incoming webhook data to map unstructured fields (e.g., "Zap", "Nome Completo") to the CRM schema automatically.
- **Google Authentication:** Secure login via NextAuth v5.

### Organization
- **Custom Columns:** Create, rename, and reorder Kanban columns.
- **Member Management:** Invite team members to your organization.

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, Shadcn/UI
- **Database:** Neon (Serverless PostgreSQL)
- **ORM:** Drizzle ORM
- **Authentication:** NextAuth.js v5
- **AI:** OpenAI SDK
- **Icons:** Lucide React

## 📦 Project Structure

```
src/
├── app/
│   ├── (authenticated)/    # Protected routes (Requires Login)
│   │   ├── admin/          # Super Admin Dashboard
│   │   └── org/[slug]/     # Organization-specific routes (Kanban, Settings)
│   ├── api/                # Backend Routes (Webhooks, Auth)
│   └── login/              # Public Login Page
├── components/
│   ├── features/           # Business Logic (Kanban, CRM View)
│   ├── layout/             # Sidebar, Header, UserMenu
│   └── ui/                 # Reusable Shadcn Components
├── lib/                    # Utilities & DB Connection
├── server/
│   ├── actions/            # Server Actions (Mutations)
│   └── db/                 # Database Schema (Drizzle)
```

## ⚡ Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/drtrafego/CRM_mvp.git
cd CRM_mvp
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:

```env
# Database (Neon)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Auth (NextAuth / Google)
AUTH_SECRET="your-generated-secret"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# AI (OpenAI)
OPENAI_API_KEY="sk-..."

# Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"
```

### 3. Run Development Server
```bash
npm run dev
```
Access `http://localhost:3000`.

## 🔌 Webhook Integration

Each organization has a unique webhook URL to receive leads automatically.

**URL Pattern:**
`POST https://[YOUR-DOMAIN]/api/webhooks/[ORG-SLUG]`

**Example Payload (JSON):**
The AI will automatically map these fields to `name`, `email`, `whatsapp`, `company`, `notes`.
```json
{
  "Nome Completo": "John Doe",
  "Email Corporativo": "john@company.com",
  "WhatsApp": "+5511999999999",
  "Empresa": "Acme Corp",
  "Mensagem": "I need a quote."
}
```

## 📜 License

This project is proprietary software.
