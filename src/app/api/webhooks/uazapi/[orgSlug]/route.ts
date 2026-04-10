import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns } from "@/server/db/schema";
import { eq, asc, and } from "drizzle-orm";

// ============================================================
// UAZapi / Evolution API / Baileys WEBHOOK ADAPTER
//
// Usado para clientes cujo WhatsApp NÃO está no Cloud API (WABA).
// Ex: Gramado Plaza — número vinculado a BM que não controlamos.
//
// Setup no painel UAZapi:
//   Webhook URL: https://crm.casaldotrafego.com/api/webhooks/uazapi/{orgSlug}
//   Eventos: messages.upsert (ou equivalente "mensagem recebida")
//   Header:  x-uazapi-token: {SYNC_API_TOKEN do CRM}
//
// Este endpoint aceita múltiplos formatos (UAZapi, Evolution, Baileys) e
// extrai telefone + nome + texto tolerando variações.
// ============================================================

const FORWARD_TOKEN = process.env.SYNC_API_TOKEN || process.env.AUTH_SECRET;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-uazapi-token, x-sync-token, authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json(
    { status: "uazapi_adapter_ok", hint: "POST JSON aqui com header x-uazapi-token" },
    { status: 200, headers: corsHeaders }
  );
}

// ============================================================
// EXTRATORES TOLERANTES
// ============================================================

type ExtractedMessage = {
  phone: string;
  pushName: string;
  text: string;
  fromMe: boolean;
  timestamp?: string;
};

function digits(s: string | undefined | null): string {
  return (s || "").toString().replace(/\D/g, "");
}

function extractPhone(remoteJid: string | undefined, fallback?: string): string {
  if (remoteJid) {
    // Formatos possíveis: "5511999999999@s.whatsapp.net", "5511999999999@c.us", "5511999999999"
    const clean = remoteJid.split("@")[0];
    const d = digits(clean);
    if (d) return d;
  }
  return digits(fallback);
}

function extractText(message: any): string {
  if (!message) return "";
  if (typeof message === "string") return message;

  // Baileys / UAZapi comum
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return `[Imagem] ${message.imageMessage.caption}`;
  if (message.imageMessage) return "[Imagem recebida]";
  if (message.videoMessage?.caption) return `[Vídeo] ${message.videoMessage.caption}`;
  if (message.videoMessage) return "[Vídeo recebido]";
  if (message.audioMessage) return "[Áudio recebido]";
  if (message.documentMessage) return "[Documento recebido]";
  if (message.stickerMessage) return "[Sticker recebido]";
  if (message.locationMessage) return "[Localização recebida]";
  if (message.contactMessage) return "[Contato compartilhado]";
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;

  // Campo "text" direto
  if (message.text) return typeof message.text === "string" ? message.text : message.text.body || "";
  if (message.body) return message.body;
  if (message.caption) return message.caption;

  return "";
}

function extractFromWebhook(body: any): ExtractedMessage[] {
  const out: ExtractedMessage[] = [];

  // Caminho 1: Evolution API / UAZapi padrão (data = objeto único OU array)
  const dataNode = body.data || body.payload || body;
  const items = Array.isArray(dataNode) ? dataNode : [dataNode];

  for (const item of items) {
    if (!item) continue;

    // Se tem .messages (array), processa cada uma
    const msgs = Array.isArray(item.messages) ? item.messages : [item];
    for (const m of msgs) {
      const key = m.key || item.key || {};
      const fromMe = !!(key.fromMe || m.fromMe || item.fromMe);
      const remoteJid = key.remoteJid || m.remoteJid || m.chatId || m.from || item.remoteJid || item.from;
      const phone = extractPhone(remoteJid, m.phone || m.number || item.phone || item.number);
      if (!phone) continue;

      const pushName =
        m.pushName ||
        m.pushname ||
        m.senderName ||
        m.notifyName ||
        m.contactName ||
        item.pushName ||
        item.senderName ||
        item.notifyName ||
        "";

      const text = extractText(m.message || m.msg || m.text || m.body || item.message || item.body || item.text);

      const timestampRaw = m.messageTimestamp || m.timestamp || m.t || item.messageTimestamp || item.timestamp;
      const timestamp =
        typeof timestampRaw === "number"
          ? new Date(timestampRaw * (timestampRaw > 10_000_000_000 ? 1 : 1000)).toISOString()
          : typeof timestampRaw === "string"
            ? timestampRaw
            : undefined;

      out.push({ phone, pushName, text, fromMe, timestamp });
    }
  }

  return out;
}

// ============================================================
// HELPERS DE LEAD
// ============================================================

async function ensureColumns(orgId: string) {
  const existing = await db.query.columns.findMany({
    where: eq(columns.organizationId, orgId),
    orderBy: [asc(columns.order)],
  });
  if (existing.length > 0) return existing;
  const defaultTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];
  const inserted = await db
    .insert(columns)
    .values(defaultTitles.map((title, i) => ({ title, organizationId: orgId, order: i })))
    .returning();
  return inserted.sort((a, b) => a.order - b.order);
}

async function leadExists(orgId: string, whatsapp: string): Promise<boolean> {
  if (!whatsapp) return false;
  const existing = await db.query.leads.findFirst({
    where: and(eq(leads.organizationId, orgId), eq(leads.whatsapp, whatsapp)),
  });
  return !!existing;
}

// ============================================================
// POST HANDLER
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  // Autenticação: x-uazapi-token OU x-sync-token OU Authorization Bearer
  const token =
    req.headers.get("x-uazapi-token") ||
    req.headers.get("x-sync-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!FORWARD_TOKEN) {
    console.warn("[UAZapi] FORWARD_TOKEN não configurado (SYNC_API_TOKEN ausente)");
  } else if (token !== FORWARD_TOKEN) {
    console.error(`[UAZapi] Token inválido (org=${orgSlug})`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  // Resolve org
  const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, orgSlug) });
  if (!org) {
    console.error(`[UAZapi] Org não encontrada: ${orgSlug}`);
    return NextResponse.json({ error: "org_not_found" }, { status: 404, headers: corsHeaders });
  }

  const event = body.event || body.type || "";
  // Só processa mensagens novas. Ignora status, presence, ack, etc.
  const isMessageEvent = !event || /message|upsert|received|incoming/i.test(event);
  if (!isMessageEvent) {
    return NextResponse.json({ status: "ignored_event", event }, { status: 200, headers: corsHeaders });
  }

  const msgs = extractFromWebhook(body);
  if (msgs.length === 0) {
    return NextResponse.json(
      { status: "no_messages", hint: "payload não teve mensagens reconhecíveis" },
      { status: 200, headers: corsHeaders }
    );
  }

  const results: Array<{ phone: string; status: string; name?: string }> = [];

  for (const m of msgs) {
    if (m.fromMe) {
      results.push({ phone: m.phone, status: "skipped_from_me" });
      continue;
    }
    // Ignora grupos (JIDs de grupo terminam em @g.us — não deveriam chegar já que extractPhone remove o sufixo, mas por segurança)
    if (!m.phone || m.phone.length < 10) {
      results.push({ phone: m.phone, status: "skipped_invalid_phone" });
      continue;
    }

    if (await leadExists(org.id, m.phone)) {
      results.push({ phone: m.phone, status: "exists" });
      continue;
    }

    const orgCols = await ensureColumns(org.id);

    await db.insert(leads).values({
      name: m.pushName || `WA ${m.phone.slice(-6)}`,
      whatsapp: m.phone,
      notes: m.text ? `Primeira mensagem: ${m.text.slice(0, 500)}` : "Nova mensagem no WhatsApp",
      organizationId: org.id,
      status: "New",
      columnId: orgCols[0].id,
      campaignSource: "WhatsApp",
      utmSource: "whatsapp",
      utmMedium: "cpc",
    });

    console.log(`[UAZapi] Lead criado: ${m.pushName} (${m.phone}) → ${orgSlug}`);
    results.push({ phone: m.phone, name: m.pushName, status: "created" });
  }

  return NextResponse.json({ status: "ok", processed: results.length, results }, { status: 200, headers: corsHeaders });
}
