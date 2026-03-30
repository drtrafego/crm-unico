import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns } from "@/server/db/schema";
import { eq, asc, and } from "drizzle-orm";

// ============================================================
// SYNC LEADS API — Endpoint genérico para ingestão de leads
//
// POST /api/sync/leads — Cria lead no CRM
// GET  /api/sync/leads?orgSlug=xxx&whatsapp=yyy — Verifica se lead existe
//
// Autenticação: Header x-sync-token com SYNC_API_TOKEN
// Uso: MCP tools, agentes, n8n, qualquer sistema externo
// ============================================================

const SYNC_TOKEN = process.env.SYNC_API_TOKEN;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-sync-token",
};

function isAuthorized(req: NextRequest): boolean {
  if (!SYNC_TOKEN) return false;
  const token = req.headers.get("x-sync-token");
  return token === SYNC_TOKEN;
}

async function ensureColumns(orgId: string) {
  const existing = await db.query.columns.findMany({
    where: eq(columns.organizationId, orgId),
    orderBy: [asc(columns.order)],
  });
  if (existing.length > 0) return existing;

  const defaultTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];
  const inserted = await db.insert(columns).values(
    defaultTitles.map((title, i) => ({ title, organizationId: orgId, order: i }))
  ).returning();
  return inserted.sort((a, b) => a.order - b.order);
}

// ============================================================
// OPTIONS — CORS preflight
// ============================================================
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// ============================================================
// GET — Verificar se lead existe (dedup check)
// GET /api/sync/leads?orgSlug=xxx&whatsapp=5511999999999
// ============================================================
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const orgSlug = req.nextUrl.searchParams.get("orgSlug");
  const whatsapp = req.nextUrl.searchParams.get("whatsapp");

  if (!orgSlug || !whatsapp) {
    return NextResponse.json({ error: "Missing orgSlug or whatsapp" }, { status: 400, headers: corsHeaders });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404, headers: corsHeaders });
  }

  const existing = await db.query.leads.findFirst({
    where: and(
      eq(leads.organizationId, org.id),
      eq(leads.whatsapp, whatsapp)
    ),
  });

  return NextResponse.json(
    { exists: !!existing, leadId: existing?.id || null },
    { status: 200, headers: corsHeaders }
  );
}

// ============================================================
// POST — Criar lead
// ============================================================
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { orgSlug, name, whatsapp, source } = body;

    if (!orgSlug || !name || !whatsapp || !source) {
      return NextResponse.json(
        { error: "Missing required fields: orgSlug, name, whatsapp, source" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolver org pelo slug
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Dedup — verificar se lead já existe pelo whatsapp + org
    const existing = await db.query.leads.findFirst({
      where: and(
        eq(leads.organizationId, org.id),
        eq(leads.whatsapp, whatsapp)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { status: "exists", leadId: existing.id },
        { status: 200, headers: corsHeaders }
      );
    }

    // Garantir que colunas existem
    const orgColumns = await ensureColumns(org.id);

    // Montar notas
    let notes: string | null = null;
    if (body.message) {
      const sourceLabel = source === "Direct" ? "DM no Instagram" : "Primeira mensagem";
      notes = `${sourceLabel}: ${body.message}`;
    }

    // Criar lead
    const [created] = await db.insert(leads).values({
      name,
      whatsapp,
      email: body.email || null,
      company: body.company || null,
      notes,
      organizationId: org.id,
      status: "New",
      columnId: orgColumns[0].id,
      campaignSource: source,
      utmSource: body.utmSource || (source === "Direct" ? "direct" : "whatsapp"),
      utmMedium: body.utmMedium || null,
      utmCampaign: body.utmCampaign || null,
      utmContent: body.utmContent || null,
    }).returning({ id: leads.id });

    console.log(`[Sync] Lead created: ${name} (${whatsapp}) → org ${orgSlug}`);

    return NextResponse.json(
      { status: "created", leadId: created.id },
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
