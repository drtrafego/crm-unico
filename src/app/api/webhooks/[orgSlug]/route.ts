import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns, leadHistory } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { normalizeSourceString } from "@/lib/leads-helper";

// Ensures columns exist for the organization, creating defaults if needed
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

// CORS headers — webhooks aceitam POST de qualquer origem (Zapier, n8n, Typeform, etc.)
// mas restringimos métodos e removemos credentials para segurança
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// SECURITY: Allowlist de domínios permitidos para redirect (previne open redirect)
const ALLOWED_REDIRECT_DOMAINS = [
  'wa.me',
  'api.whatsapp.com',
  'casaldotrafego.com',
  'drtrafego.com',
  'crm-unico.vercel.app',
];

function isRedirectAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Só permite HTTPS (exceto localhost em dev)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Verifica se o domínio está na allowlist
    return ALLOWED_REDIRECT_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function safeRedirect(url: string | null, fallbackResponse: NextResponse): NextResponse {
  if (!url) return fallbackResponse;
  if (!isRedirectAllowed(url)) {
    console.warn(`[Webhook] Blocked redirect to non-allowed URL: ${url}`);
    return fallbackResponse;
  }
  return NextResponse.redirect(url, { status: 302, headers: corsHeaders });
}

// Handle preflight requests (OPTIONS)
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Smart field normalization that supports multiple formats including Elementor
function normalizeLeadData(rawData: Record<string, any>) {
  // 0. Create a lowercase key map for easier lookup
  const lowerCasedRawData: Record<string, any> = {};
  for (const key of Object.keys(rawData)) {
    lowerCasedRawData[key.toLowerCase()] = rawData[key];
  }

  // First, check if data is in Elementor format: fields[fieldname][value]
  const elementorData: Record<string, string> = {};
  for (const key of Object.keys(rawData)) { // still check original keys for regex
    // Match pattern: fields[NAME][value] or fields[NAME][raw_value]
    const match = key.match(/^fields\[(\w+)\]\[(value|raw_value)\]$/);
    if (match) {
      const fieldName = match[1].toLowerCase();
      // Prefer raw_value if exists, otherwise use value
      if (!elementorData[fieldName] || match[2] === 'raw_value') {
        elementorData[fieldName] = String(rawData[key]);
      }
    }
  }

  // Elementor data parsed (not logged for PII compliance)

  // Merge: use Elementor data if available, otherwise use LOWERCASED raw data
  const dataToNormalize = Object.keys(elementorData).length > 0 ? elementorData : lowerCasedRawData;

  // Field name mappings (now simpler since Elementor data is pre-processed)
  const nameFields = ['name', 'nome', 'nome_completo', 'full_name', 'fullname'];
  const emailFields = ['email', 'e-mail', 'email_corporativo'];
  const phoneFields = ['phone', 'telefone', 'whatsapp', 'celular', 'tel', 'fone', 'mobile'];
  const companyFields = ['company', 'empresa', 'company_name'];
  const messageFields = ['message', 'mensagem', 'notes', 'observacoes', 'observacao'];

  const findValue = (fields: string[]) => {
    for (const field of fields) {
      // Lookup is now simple because keys in dataToNormalize are guaranteed lowercase
      const value = dataToNormalize[field];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return null;
  };

  const result = {
    name: findValue(nameFields),
    email: findValue(emailFields),
    phone: findValue(phoneFields),
    company: findValue(companyFields),
    message: findValue(messageFields),
  };

  // Normalized result ready (not logged for PII compliance)

  return result;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  // Get redirect URL from query parameter (e.g., ?redirect=https://wa.me/5511999999999)
  const redirectUrl = req.nextUrl.searchParams.get('redirect');

  try {
    // 1. Validate Organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    if (!org) {
      console.error(`[Webhook] Organization not found: ${orgSlug}`);
      const notFoundResp = NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404, headers: corsHeaders }
      );
      if (redirectUrl) return safeRedirect(redirectUrl, notFoundResp);
      return notFoundResp;
    }

    // 2. Parse Request Body
    let rawData: Record<string, any> = {};
    const contentType = req.headers.get("content-type") || "";


    try {
      if (contentType.includes("application/json")) {
        rawData = await req.json();
      } else if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        rawData = Object.fromEntries(formData.entries());
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        rawData = Object.fromEntries(new URLSearchParams(text));
      } else {
        const text = await req.text();
        try {
          rawData = JSON.parse(text);
        } catch {
          rawData = Object.fromEntries(new URLSearchParams(text));
        }
      }
    } catch (parseError) {
      console.error("[Webhook] Parse error:", parseError);
      const parseResp = NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400, headers: corsHeaders }
      );
      if (redirectUrl) return safeRedirect(redirectUrl, parseResp);
      return parseResp;
    }

    console.log("[Webhook] Received lead data for org:", orgSlug);

    // 3. Normalize and Save Lead
    const normalizedData = normalizeLeadData(rawData);

    // --- Smart Source Logic ---
    const utmSource = rawData.utm_source || rawData.source;
    const utmMedium = rawData.utm_medium || rawData.medium;
    const utmCampaign = rawData.utm_campaign || rawData.campaign;
    const utmTerm = rawData.utm_term || rawData.term || rawData.keyword;
    const utmContent = rawData.utm_content || rawData.content;
    const pagePath = rawData.page_path || rawData.page || rawData.url;

    // 1. Tries to use the explicit campaign source
    let rawCampaignSource = rawData.campaignSource || rawData.campaign_source || rawData.origem;

    // 2. If not present, tries to use UTM Source
    if (!rawCampaignSource) {
      rawCampaignSource = utmSource;
    }

    // 3. Normalize the result using the centralized helper
    let campaignSource = normalizeSourceString(rawCampaignSource);

    // 4. If normalization failed (returned null), use the raw string.
    //    If both are null, fallback to "Direto"
    if (!campaignSource) {
      campaignSource = rawCampaignSource || "Direto";
    }
    // --------------------------

    const orgColumns = await ensureColumns(org.id);
    const defaultColumn = orgColumns[0];

    const newLead = await db.insert(leads).values({
      name: normalizedData.name || "Sem Nome",
      email: normalizedData.email,
      whatsapp: normalizedData.phone,
      company: normalizedData.company,
      notes: normalizedData.message,
      organizationId: org.id,
      status: "New",
      columnId: defaultColumn.id,
      // Smart Source Fields
      campaignSource: campaignSource,
      utmSource: utmSource,
      utmMedium: utmMedium,
      utmCampaign: utmCampaign,
      utmTerm: utmTerm,
      utmContent: utmContent,
      pagePath: pagePath
    }).returning();

    // History logging is handled by DB trigger

    console.log("[Webhook] Lead saved:", newLead[0]?.id);

    // 4. REDIRECT if URL provided, otherwise return JSON
    const successResp = NextResponse.json(
      { success: true, message: "Lead created successfully", leadId: newLead[0]?.id },
      { status: 200, headers: corsHeaders }
    );
    if (redirectUrl) {
      console.log("[Webhook] Redirecting to:", redirectUrl);
      return safeRedirect(redirectUrl, successResp);
    }
    return successResp;

  } catch (error) {
    console.error("[Webhook] Error:", error);

    const errorResp = NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
    if (redirectUrl) return safeRedirect(redirectUrl, errorResp);
    return errorResp;
  }
}

// Also support GET for simple form submissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const redirectUrl = req.nextUrl.searchParams.get('redirect');

  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    if (!org) {
      const notFoundResp = NextResponse.json({ error: "Organization not found" }, { status: 404, headers: corsHeaders });
      if (redirectUrl) return safeRedirect(redirectUrl, notFoundResp);
      return notFoundResp;
    }

    // Get all query params except 'redirect' as lead data
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    delete searchParams.redirect;

    const normalizedData = normalizeLeadData(searchParams);

    // --- Smart Source Logic ---
    const utmSource = searchParams.utm_source || searchParams.source;
    const utmMedium = searchParams.utm_medium || searchParams.medium;
    const utmCampaign = searchParams.utm_campaign || searchParams.campaign;
    const utmTerm = searchParams.utm_term || searchParams.term || searchParams.keyword;
    const utmContent = searchParams.utm_content || searchParams.content;
    const pagePath = searchParams.page_path || searchParams.page || searchParams.url;

    // 1. Tries to use the explicit campaign source
    let rawCampaignSource = searchParams.campaignSource || searchParams.campaign_source || searchParams.origem;

    // 2. If not present, tries to use UTM Source
    if (!rawCampaignSource) {
      rawCampaignSource = utmSource;
    }

    // 3. Normalize the result using the centralized helper
    let campaignSource = normalizeSourceString(rawCampaignSource as string);

    // 4. If normalization failed (returned null), use the raw string.
    //    If both are null, fallback to "Direto"
    if (!campaignSource) {
      campaignSource = (rawCampaignSource as string) || "Direto";
    }
    // --------------------------

    const orgColumns = await ensureColumns(org.id);
    const defaultColumn = orgColumns[0];

    const newLead = await db.insert(leads).values({
      name: normalizedData.name || "Sem Nome",
      email: normalizedData.email,
      whatsapp: normalizedData.phone,
      company: normalizedData.company,
      notes: normalizedData.message,
      organizationId: org.id,
      status: "New",
      columnId: defaultColumn.id,
      // Smart Source Fields
      campaignSource: campaignSource,
      utmSource: utmSource as string,
      utmMedium: utmMedium as string,
      utmCampaign: utmCampaign as string,
      utmTerm: utmTerm as string,
      utmContent: utmContent as string,
      pagePath: pagePath as string
    }).returning();

    // History logging is handled by DB trigger

    console.log("[Webhook GET] Lead saved:", newLead[0]?.id);

    const getSuccessResp = NextResponse.json(
      { success: true, leadId: newLead[0]?.id },
      { status: 200, headers: corsHeaders }
    );
    if (redirectUrl) return safeRedirect(redirectUrl, getSuccessResp);
    return getSuccessResp;

  } catch (error) {
    console.error("[Webhook GET] Error:", error);
    const getErrorResp = NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
    if (redirectUrl) return safeRedirect(redirectUrl, getErrorResp);
    return getErrorResp;
  }
}
