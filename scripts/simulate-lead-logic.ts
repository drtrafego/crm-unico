
import { config } from "dotenv";
config({ path: ".env.local" });

const { db } = require("../src/lib/db");
const { leads, leadHistory } = require("../src/server/db/schema");
const { eq } = require("drizzle-orm");

// --- Replica da lógica do leads-helper.ts ---
function normalizeSourceString(source) {
    if (!source) return null;
    const s = source.toLowerCase().trim();

    if (s.includes('google') || s.includes('adwords') || s.includes('gads')) return 'Google';
    if (s.includes('facebook') || s.includes('meta') || s.includes('instagram') || s.includes('fb')) return 'Meta';
    if (s.includes('tiktok')) return 'TikTok';
    if (s.includes('linkedin')) return 'LinkedIn';
    if (s.includes('youtube')) return 'YouTube';
    if (s.includes('organic') || s.includes('orgânico')) return 'Orgânicos';
    if (s.includes('email') || s.includes('e-mail')) return 'Email Marketing';
    if (s.includes('indication') || s.includes('indicação')) return 'Indicação';
    if (s.includes('manual')) return 'Manual';

    return null; // Return null if no match found (to allow fallback to raw string)
}

// --- Simulação do Webhook ---
async function main() {
    console.log("Simulating Webhook Logic for Google Lead...");

    // 1. Mock Input Data (como viria do request)
    const rawData = {
        name: "Teste Google Simulacao",
        email: "teste.google.sim@example.com",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "campaign-test-123"
    };

    // 2. Logic extraction (from route.ts)
    const utmSource = rawData.utm_source;
    let rawCampaignSource = rawData.utm_source; // Fallback to utm_source

    // 3. Normalization
    let campaignSource = normalizeSourceString(rawCampaignSource);

    console.log(`Input Source: "${rawCampaignSource}"`);
    console.log(`Normalized Source: "${campaignSource}"`); // Should be "Google"

    if (!campaignSource) {
        campaignSource = rawCampaignSource || "Direto";
    }

    // 4. Insert into DB (Felipe's Org: a20d05cd-ea77-4456-8feb-586eeca3cfea)
    const ORG_ID = 'a20d05cd-ea77-4456-8feb-586eeca3cfea';

    // Find default column
    const defaultColumn = await db.query.columns.findFirst({
        where: eq(require("../src/server/db/schema").columns.organizationId, ORG_ID),
        orderBy: (columns, { asc }) => [asc(columns.order)],
    });

    console.log(`Inserting into Column: ${defaultColumn?.title || 'Unknown'}`);

    const newLead = await db.insert(leads).values({
        name: rawData.name,
        email: rawData.email,
        organizationId: ORG_ID,
        status: "New",
        columnId: defaultColumn?.id,
        campaignSource: campaignSource, // The critical field
        utmSource: rawData.utm_source,
        utmMedium: rawData.utm_medium,
        utmCampaign: rawData.utm_campaign,
        createdAt: new Date()
    }).returning();

    console.log("Lead Inserted:", newLead[0].id);
    console.log("Final Campaign Source:", newLead[0].campaignSource);

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
