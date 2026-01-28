import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, leads, columns, leadHistory } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { normalizeSourceString } from "@/lib/leads-helper";

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  "Access-Control-Allow-Credentials": "true",
};

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

  console.log("[Webhook] Elementor parsed:", JSON.stringify(elementorData));

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

  console.log("[Webhook] Normalized result:", JSON.stringify(result));

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
      // Even if org not found, redirect if URL provided
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404, headers: corsHeaders }
      );
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
      // Still try to redirect even on parse error
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("[Webhook] Received:", JSON.stringify(rawData));

    // 3. Normalize and Save Lead
    const normalizedData = normalizeLeadData(rawData);

    // --- Smart Source Logic ---
    const utmSource = rawData.utm_source || rawData.source;
    const utmMedium = rawData.utm_medium || rawData.medium;
    const utmCampaign = rawData.utm_campaign || rawData.campaign;

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

    const defaultColumn = await db.query.columns.findFirst({
      where: eq(columns.organizationId, org.id),
      orderBy: (columns, { asc }) => [asc(columns.order)],
    });

    const newLead = await db.insert(leads).values({
      name: normalizedData.name || "Sem Nome",
      email: normalizedData.email,
      whatsapp: normalizedData.phone,
      company: normalizedData.company,
      notes: normalizedData.message,
      organizationId: org.id,
      status: "New",
      columnId: defaultColumn?.id,
      // Smart Source Fields
      campaignSource: campaignSource,
      utmSource: utmSource,
      utmMedium: utmMedium,
      utmCampaign: utmCampaign
    }).returning();

    if (newLead[0]) {
      await db.insert(leadHistory).values({
        leadId: newLead[0].id,
        action: 'create',
        details: `Lead criado via Webhook em ${defaultColumn?.title || 'Coluna Inicial'}`,
        toColumn: defaultColumn?.id,
      });
    }

    console.log("[Webhook] Lead saved:", newLead[0]?.id);

    // 4. REDIRECT if URL provided, otherwise return JSON
    if (redirectUrl) {
      console.log("[Webhook] Redirecting to:", redirectUrl);
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: corsHeaders
      });
    }

    // Fallback: return JSON success
    return NextResponse.json(
      { success: true, message: "Lead created successfully", leadId: newLead[0]?.id },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("[Webhook] Error:", error);

    // Even on error, try to redirect if URL provided
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
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
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
      }
      return NextResponse.json({ error: "Organization not found" }, { status: 404, headers: corsHeaders });
    }

    // Get all query params except 'redirect' as lead data
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    delete searchParams.redirect;

    const normalizedData = normalizeLeadData(searchParams);

    // --- Smart Source Logic ---
    const utmSource = searchParams.utm_source || searchParams.source;
    const utmMedium = searchParams.utm_medium || searchParams.medium;
    const utmCampaign = searchParams.utm_campaign || searchParams.campaign;

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

    const defaultColumn = await db.query.columns.findFirst({
      where: eq(columns.organizationId, org.id),
      orderBy: (columns, { asc }) => [asc(columns.order)],
    });

    const newLead = await db.insert(leads).values({
      name: normalizedData.name || "Sem Nome",
      email: normalizedData.email,
      whatsapp: normalizedData.phone,
      company: normalizedData.company,
      notes: normalizedData.message,
      organizationId: org.id,
      status: "New",
      columnId: defaultColumn?.id,
      // Smart Source Fields
      campaignSource: campaignSource,
      utmSource: utmSource as string,
      utmMedium: utmMedium as string,
      utmCampaign: utmCampaign as string
    }).returning();

    if (newLead[0]) {
      await db.insert(leadHistory).values({
        leadId: newLead[0].id,
        action: 'create',
        details: `Lead criado via Webhook (GET) em ${defaultColumn?.title || 'Coluna Inicial'}`,
        toColumn: defaultColumn?.id,
      });
    }

    console.log("[Webhook GET] Lead saved:", newLead[0]?.id);

    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: true, leadId: newLead[0]?.id },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("[Webhook GET] Error:", error);
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
