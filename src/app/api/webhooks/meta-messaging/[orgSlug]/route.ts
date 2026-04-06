import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns, metaIntegrations } from "@/server/db/schema";
import { eq, asc, and, or } from "drizzle-orm";
import crypto from "crypto";

// ============================================================
// META MESSAGING WEBHOOK - ROTEAMENTO AUTOMÁTICO
//
// Endpoint ÚNICO: /api/webhooks/meta-messaging/{orgSlug}
//   - orgSlug pode ser o slug real OU "router" para auto-routing
//
// Fluxo:
//   1. Meta (ou agente externo) envia webhook pra cá
//   2. Se orgSlug = "router", busca a org pelo phone_number_id/waba_id/ig_account_id
//      na tabela meta_integrations (configurado nas Settings do cliente)
//   3. Se orgSlug = slug real, usa direto (fallback/compatibilidade)
//   4. Cria o lead no CRM do cliente certo
//
// Segurança:
//   - GET: Verifica hub.verify_token
//   - POST: Verifica X-Hub-Signature-256 (HMAC SHA256) se META_APP_SECRET configurado
//           OU x-forward-token para webhooks encaminhados por agentes externos
//
// Modos de uso:
//   A) Meta direto → Callback URL: https://crm.../api/webhooks/meta-messaging/router
//   B) Via agente/MCP → POST com header x-forward-token (pula HMAC, agente já validou)
// ============================================================

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "crm_meta_verify_2024";
const META_APP_SECRET = process.env.META_APP_SECRET;
const FORWARD_TOKEN = process.env.SYNC_API_TOKEN || process.env.AUTH_SECRET;

/**
 * Verifica a assinatura X-Hub-Signature-256 enviada pela Meta.
 * Usa timing-safe comparison para prevenir timing attacks.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!META_APP_SECRET) return true; // Se não configurado, pula (log warning)
  if (!signatureHeader) return false;

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ============================================================
// HELPERS
// ============================================================

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

async function leadExists(orgId: string, whatsapp: string): Promise<boolean> {
  if (!whatsapp) return false;
  const existing = await db.query.leads.findFirst({
    where: and(
      eq(leads.organizationId, orgId),
      eq(leads.whatsapp, whatsapp)
    ),
  });
  return !!existing;
}

/**
 * Resolve a organização:
 * - Se orgSlug != "router", busca pelo slug
 * - Se orgSlug == "router", busca pelo mapeamento Meta
 *   Suporta WABA (phone_number_id, waba_id) E Business Number (whatsapp_number)
 */
async function resolveOrganization(
  orgSlug: string,
  identifiers: { wabaId?: string; phoneNumberId?: string; igAccountId?: string; displayPhoneNumber?: string }
): Promise<string | null> {
  // Modo direto: slug real
  if (orgSlug !== "router") {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });
    return org?.id || null;
  }

  // Modo router: busca pela tabela meta_integrations
  // Prioridade: phone_number_id > waba_id > whatsapp_number > ig_account_id

  // 1. WABA: phone_number_id
  if (identifiers.phoneNumberId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.phoneNumberId, identifiers.phoneNumberId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) {
      console.log(`[Meta Router] Matched phone_number_id ${identifiers.phoneNumberId} → org ${match.organizationId}`);
      return match.organizationId;
    }
  }

  // 2. WABA: waba_id
  if (identifiers.wabaId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.wabaId, identifiers.wabaId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) {
      console.log(`[Meta Router] Matched waba_id ${identifiers.wabaId} → org ${match.organizationId}`);
      return match.organizationId;
    }
  }

  // 3. Business Number: display_phone_number do metadata
  if (identifiers.displayPhoneNumber) {
    const cleanPhone = identifiers.displayPhoneNumber.replace(/\D/g, "");
    if (cleanPhone) {
      const match = await db.query.metaIntegrations.findFirst({
        where: and(
          eq(metaIntegrations.whatsappNumber, cleanPhone),
          eq(metaIntegrations.isActive, true)
        ),
      });
      if (match) {
        console.log(`[Meta Router] Matched whatsapp_number ${cleanPhone} → org ${match.organizationId}`);
        return match.organizationId;
      }
    }
  }

  // 4. Instagram: ig_account_id
  if (identifiers.igAccountId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.igAccountId, identifiers.igAccountId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) {
      console.log(`[Meta Router] Matched ig_account_id ${identifiers.igAccountId} → org ${match.organizationId}`);
      return match.organizationId;
    }
  }

  console.error(`[Meta Router] No org found for identifiers:`, identifiers);
  return null;
}

/**
 * Extrai os IDs do Meta a partir do payload do webhook
 */
function extractMetaIds(body: any): {
  wabaId?: string;
  phoneNumberId?: string;
  igAccountId?: string;
  displayPhoneNumber?: string;
} {
  const objectType = body.object;
  const entry = body.entry?.[0];

  if (!entry) return {};

  if (objectType === "whatsapp_business_account") {
    const metadata = entry.changes?.[0]?.value?.metadata;
    return {
      wabaId: entry.id,
      phoneNumberId: metadata?.phone_number_id,
      displayPhoneNumber: metadata?.display_phone_number, // Para match com business_number
    };
  }

  if (objectType === "instagram") {
    return { igAccountId: entry.id };
  }

  if (objectType === "page") {
    return { igAccountId: entry.id };
  }

  return {};
}

function extractMessageText(message: any): string {
  switch (message.type) {
    case "text": return message.text?.body || "";
    case "image": return "[Imagem recebida]";
    case "video": return "[Vídeo recebido]";
    case "audio": return "[Áudio recebido]";
    case "document": return "[Documento recebido]";
    case "sticker": return "[Sticker recebido]";
    case "location": return `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
    case "contacts": return "[Contato compartilhado]";
    case "interactive": return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[Resposta interativa]";
    case "button": return message.button?.text || "[Botão clicado]";
    default: return "";
  }
}

// ============================================================
// GET - Meta Webhook Verification
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  console.log(`[Meta Webhook] Verification for: ${orgSlug}, mode: ${mode}`);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log(`[Meta Webhook] Verification SUCCESS`);
    return new NextResponse(challenge, { status: 200, headers: corsHeaders });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// ============================================================
// POST - Receive & Route Meta Webhooks
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  try {
    const rawBody = await req.text();

    // Autenticação: aceita HMAC da Meta OU token de forward de agente externo
    const forwardToken = req.headers.get('x-forward-token');
    const isForwarded = forwardToken && FORWARD_TOKEN && forwardToken === FORWARD_TOKEN;

    if (!isForwarded) {
      // Verificar assinatura X-Hub-Signature-256 (HMAC SHA256)
      const signature = req.headers.get('x-hub-signature-256');

      if (META_APP_SECRET && !verifyMetaSignature(rawBody, signature)) {
        console.error(`[Meta Webhook] Assinatura inválida, possível ataque`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers: corsHeaders });
      }

      if (!META_APP_SECRET) {
        console.warn(`[Meta Webhook] META_APP_SECRET não configurado, assinatura não verificada`);
      }
    } else {
      console.log(`[Meta Webhook] Forward confiável recebido via x-forward-token`);
    }

    const body = JSON.parse(rawBody);
    const objectType = body.object;

    // Extrair IDs do Meta para roteamento
    const metaIds = extractMetaIds(body);
    console.log(`[Meta Webhook] type=${objectType}, slug=${orgSlug}, ids=`, metaIds);

    // Resolver organização (por slug direto OU por mapeamento)
    const orgId = await resolveOrganization(orgSlug, metaIds);

    if (!orgId) {
      console.error(`[Meta Webhook] Could not resolve org. slug=${orgSlug}, ids=`, metaIds);
      return NextResponse.json({ status: "org_not_found" }, { status: 200, headers: corsHeaders });
    }

    // Processar por plataforma
    if (objectType === "whatsapp_business_account") {
      await handleWhatsApp(body, orgId);
    } else if (objectType === "instagram") {
      await handleInstagram(body, orgId);
    } else {
      console.log(`[Meta Webhook] Unhandled object type: ${objectType}`);
    }

    return NextResponse.json({ status: "received" }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("[Meta Webhook] Error:", error);
    return NextResponse.json({ status: "error_logged" }, { status: 200, headers: corsHeaders });
  }
}

// ============================================================
// WHATSAPP HANDLER
// ============================================================
async function handleWhatsApp(body: any, orgId: string) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value?.messages?.length) continue;

      const message = value.messages[0];
      if (message.type === "reaction" || message.type === "system") continue;

      const phone = message.from;
      const contactName = value.contacts?.[0]?.profile?.name || "Sem Nome";
      const messageText = extractMessageText(message);
      const referral = message.referral || value.referral || {};

      console.log(`[Meta/WA] ${contactName} (${phone}) → org ${orgId}`);

      if (await leadExists(orgId, phone)) {
        console.log(`[Meta/WA] Lead already exists: ${phone}`);
        continue;
      }

      const orgColumns = await ensureColumns(orgId);

      await db.insert(leads).values({
        name: contactName,
        whatsapp: phone,
        notes: messageText ? `Primeira mensagem: ${messageText}` : null,
        organizationId: orgId,
        status: "New",
        columnId: orgColumns[0].id,
        campaignSource: "WhatsApp",
        utmSource: "whatsapp",
        utmMedium: "cpc",
        utmCampaign: referral.headline || referral.source_id || null,
        utmContent: referral.body || null,
      });

      console.log(`[Meta/WA] Lead created for ${contactName} (${phone})`);
    }
  }
}

// ============================================================
// INSTAGRAM HANDLER
// ============================================================
async function handleInstagram(body: any, orgId: string) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message) continue;

      const senderId = event.sender?.id;
      const messageText = event.message?.text || "";
      const referral = event.referral || {};

      if (!senderId) continue;

      // Tentar buscar username via Graph API
      let igUsername = "";
      let igName = "";
      try {
        const accessToken = process.env.META_ACCESS_TOKEN;
        if (accessToken) {
          const res = await fetch(
            `https://graph.instagram.com/${senderId}?fields=name,username`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (res.ok) {
            const data = await res.json();
            igUsername = data.username || "";
            igName = data.name || "";
          }
        }
      } catch {}

      const leadName = igName || (igUsername ? `@${igUsername}` : `IG Lead ${senderId.slice(-6)}`);
      const igIdentifier = igUsername ? `@${igUsername}` : `ig:${senderId}`;

      console.log(`[Meta/IG] ${leadName} (${igIdentifier}) → org ${orgId}`);

      if (await leadExists(orgId, igIdentifier)) {
        console.log(`[Meta/IG] Lead already exists: ${igIdentifier}`);
        continue;
      }

      const orgColumns = await ensureColumns(orgId);

      await db.insert(leads).values({
        name: leadName,
        whatsapp: igIdentifier,
        notes: messageText ? `DM no Instagram: ${messageText}` : "Enviou DM no Instagram",
        organizationId: orgId,
        status: "New",
        columnId: orgColumns[0].id,
        campaignSource: "Direct",
        utmSource: "direct",
        utmMedium: "cpc",
        utmCampaign: referral.ad_id || null,
        utmContent: referral.ref || null,
      });

      console.log(`[Meta/IG] Lead created for ${leadName}`);
    }
  }
}
