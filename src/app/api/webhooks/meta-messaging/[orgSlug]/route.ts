import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns, leadHistory } from "@/server/db/schema";
import { eq, asc, and } from "drizzle-orm";

// ============================================================
// META MESSAGING WEBHOOK
// Recebe webhooks do WhatsApp Cloud API e Instagram Messaging API
// URL: /api/webhooks/meta-messaging/{orgSlug}
//
// Cada cliente configura no Meta Developer Console:
//   Webhook URL: https://seu-crm.vercel.app/api/webhooks/meta-messaging/{orgSlug}
//   Verify Token: configurado via env META_WEBHOOK_VERIFY_TOKEN
//
// Suporta:
//   - WhatsApp Cloud API (object: "whatsapp_business_account")
//   - Instagram Messaging API (object: "instagram")
// ============================================================

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "crm_meta_verify_2024";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Ensures columns exist for the organization
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

// Check if lead with same whatsapp already exists for this org (deduplication)
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

// ============================================================
// GET - Meta Webhook Verification
// Meta sends: GET ?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  console.log(`[Meta Webhook] Verification request for org: ${orgSlug}, mode: ${mode}`);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log(`[Meta Webhook] Verification SUCCESS for org: ${orgSlug}`);
    return new NextResponse(challenge, { status: 200, headers: corsHeaders });
  }

  console.error(`[Meta Webhook] Verification FAILED for org: ${orgSlug}`);
  return NextResponse.json(
    { error: "Verification failed" },
    { status: 403, headers: corsHeaders }
  );
}

// ============================================================
// OPTIONS - CORS Preflight
// ============================================================
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// ============================================================
// POST - Receive Meta Webhook Events
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  try {
    const body = await req.json();
    const objectType = body.object; // "whatsapp_business_account" or "instagram"

    console.log(`[Meta Webhook] Received event for org: ${orgSlug}, type: ${objectType}`);

    // Validate organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    if (!org) {
      console.error(`[Meta Webhook] Organization not found: ${orgSlug}`);
      // Still return 200 to Meta (otherwise they'll retry and eventually disable the webhook)
      return NextResponse.json({ status: "org_not_found" }, { status: 200, headers: corsHeaders });
    }

    // Route based on platform
    if (objectType === "whatsapp_business_account") {
      await handleWhatsAppWebhook(body, org.id);
    } else if (objectType === "instagram") {
      await handleInstagramWebhook(body, org.id);
    } else if (objectType === "page") {
      // Facebook Messenger (future support)
      await handleMessengerWebhook(body, org.id);
    } else {
      console.log(`[Meta Webhook] Unknown object type: ${objectType}`);
    }

    // ALWAYS return 200 to Meta (required by their webhook contract)
    return NextResponse.json(
      { status: "received" },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("[Meta Webhook] Error:", error);
    // Still return 200 to avoid Meta disabling the webhook
    return NextResponse.json(
      { status: "error_logged" },
      { status: 200, headers: corsHeaders }
    );
  }
}

// ============================================================
// WHATSAPP HANDLER
// Payload: body.entry[].changes[].value.messages[]
// ============================================================
async function handleWhatsAppWebhook(body: any, orgId: string) {
  const entries = body.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value?.messages?.length) continue;

      // Only process the first message (avoid duplicates from batch)
      const message = value.messages[0];
      const contacts = value.contacts || [];
      const metadata = value.metadata || {};

      // Skip non-text messages for lead creation (reactions, read receipts, etc.)
      if (message.type === "reaction" || message.type === "system") continue;

      const phone = message.from; // e.g., "5511999999999"
      const contactName = contacts[0]?.profile?.name || "Sem Nome";
      const messageText = extractMessageText(message);

      // Referral data (from Click-to-WhatsApp ads)
      const referral = message.referral || value.referral || {};

      console.log(`[Meta Webhook/WA] New message from ${contactName} (${phone})`);

      // Deduplication: skip if lead with same phone already exists
      if (await leadExists(orgId, phone)) {
        console.log(`[Meta Webhook/WA] Lead already exists for ${phone}, skipping`);
        continue;
      }

      // Create lead
      const orgColumns = await ensureColumns(orgId);
      const defaultColumn = orgColumns[0];

      const newLead = await db.insert(leads).values({
        name: contactName,
        whatsapp: phone,
        notes: messageText ? `Primeira mensagem: ${messageText}` : null,
        organizationId: orgId,
        status: "New",
        columnId: defaultColumn.id,
        campaignSource: "WhatsApp",
        utmSource: "whatsapp",
        utmMedium: "cpc",
        utmCampaign: referral.headline || referral.source_id || null,
        utmContent: referral.body || null,
      }).returning();

      console.log(`[Meta Webhook/WA] Lead created: ${newLead[0]?.id} - ${contactName} (${phone})`);
    }
  }
}

// ============================================================
// INSTAGRAM HANDLER
// Payload: body.entry[].messaging[]
// ============================================================
async function handleInstagramWebhook(body: any, orgId: string) {
  const entries = body.entry || [];

  for (const entry of entries) {
    const messagingEvents = entry.messaging || [];

    for (const event of messagingEvents) {
      // Skip if no message (could be a read receipt, typing indicator, etc.)
      if (!event.message) continue;

      const senderId = event.sender?.id; // Instagram Scoped User ID (IGSID)
      const messageText = event.message?.text || "";

      // Referral data (from Click-to-DM ads)
      const referral = event.referral || {};

      if (!senderId) continue;

      console.log(`[Meta Webhook/IG] New DM from IGSID: ${senderId}`);

      // Try to get Instagram username via Graph API
      let igUsername = "";
      let igName = "";
      try {
        const accessToken = process.env.META_ACCESS_TOKEN;
        if (accessToken) {
          const response = await fetch(
            `https://graph.instagram.com/${senderId}?fields=name,username&access_token=${accessToken}`
          );
          if (response.ok) {
            const userData = await response.json();
            igUsername = userData.username || "";
            igName = userData.name || "";
          }
        }
      } catch (err) {
        console.log(`[Meta Webhook/IG] Could not fetch IG profile for ${senderId}:`, err);
      }

      // Build lead name: prefer IG name, then @username, then IGSID
      const leadName = igName || (igUsername ? `@${igUsername}` : `IG Lead ${senderId.slice(-6)}`);

      // Use IGSID as a pseudo "whatsapp" field for deduplication
      // (We store the IG identifier in the whatsapp field since there's no dedicated field)
      const igIdentifier = igUsername ? `@${igUsername}` : `ig:${senderId}`;

      // Deduplication
      if (await leadExists(orgId, igIdentifier)) {
        console.log(`[Meta Webhook/IG] Lead already exists for ${igIdentifier}, skipping`);
        continue;
      }

      // Create lead
      const orgColumns = await ensureColumns(orgId);
      const defaultColumn = orgColumns[0];

      const newLead = await db.insert(leads).values({
        name: leadName,
        whatsapp: igIdentifier, // Stored for identification/deduplication
        notes: messageText ? `DM no Instagram: ${messageText}` : "Enviou DM no Instagram",
        organizationId: orgId,
        status: "New",
        columnId: defaultColumn.id,
        campaignSource: "Direct",
        utmSource: "direct",
        utmMedium: "cpc",
        utmCampaign: referral.ad_id || null,
        utmContent: referral.ref || null,
      }).returning();

      console.log(`[Meta Webhook/IG] Lead created: ${newLead[0]?.id} - ${leadName}`);
    }
  }
}

// ============================================================
// MESSENGER HANDLER (Future support)
// ============================================================
async function handleMessengerWebhook(body: any, orgId: string) {
  console.log(`[Meta Webhook/Messenger] Received event, not yet implemented`);
  // Future: handle Facebook Messenger messages
}

// ============================================================
// HELPERS
// ============================================================
function extractMessageText(message: any): string {
  switch (message.type) {
    case "text":
      return message.text?.body || "";
    case "image":
      return "[Imagem recebida]";
    case "video":
      return "[Vídeo recebido]";
    case "audio":
      return "[Áudio recebido]";
    case "document":
      return "[Documento recebido]";
    case "sticker":
      return "[Sticker recebido]";
    case "location":
      return `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
    case "contacts":
      return "[Contato compartilhado]";
    case "interactive":
      return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[Resposta interativa]";
    case "button":
      return message.button?.text || "[Botão clicado]";
    default:
      return "";
  }
}
