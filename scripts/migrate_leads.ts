
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function migrate() {
    console.log("Starting migration script...");
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_ADMIN;

    if (!clientUrl || !adminUrl) {
        console.error("❌ Erro: URLs de banco de dados não encontradas no .env.local");
        process.exit(1);
    }

    const clientSql = neon(clientUrl);
    const adminSql = neon(adminUrl);

    // Target Organization in Client DB (The one with slug 'admin')
    const orgs = await clientSql`SELECT id FROM organizations WHERE slug = 'admin' LIMIT 1`;
    if (orgs.length === 0) {
        console.error("❌ Erro: Organização alvo (slug 'admin') não encontrada no Client DB.");
        process.exit(1);
    }
    const TARGET_ORG_ID = orgs[0].id;

    // Source Organization IDs in Admin DB
    const SOURCE_ORG_IDS = ["bilder_agency_shared", "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5"];

    console.log(`🚀 Organização Alvo: ${TARGET_ORG_ID}`);

    // 1. Build Column Map
    console.log("Fetching columns...");
    const targetCols = await clientSql`SELECT id, title FROM columns WHERE organization_id = ${TARGET_ORG_ID}`;
    const sourceCols = await adminSql`SELECT id, title FROM columns WHERE organization_id = ANY(${SOURCE_ORG_IDS})`;

    const titleToTargetId = new Map<string, string>();
    targetCols.forEach(c => titleToTargetId.set(String(c.title).trim().toLowerCase(), c.id));

    const sourceIdToTargetId = new Map<string, string>();
    sourceCols.forEach(sc => {
        const tid = titleToTargetId.get(String(sc.title).trim().toLowerCase());
        if (tid) sourceIdToTargetId.set(sc.id, tid);
    });

    console.log(`📊 Map de Colunas: ${sourceIdToTargetId.size} mapeadas.`);

    // 2. Fetch/Migrate Leads
    console.log("Fetching leads...");
    const sourceLeads = await adminSql`SELECT * FROM leads WHERE organization_id = ANY(${SOURCE_ORG_IDS})`;
    console.log(`📦 Leads encontrados: ${sourceLeads.length}`);

    let count = 0;
    for (const lead of sourceLeads) {
        const targetColId = lead.column_id ? sourceIdToTargetId.get(lead.column_id) : null;
        try {
            await clientSql`
                INSERT INTO leads (
                    id, name, company, email, whatsapp, campaign_source, status, 
                    column_id, position, organization_id, notes, value, 
                    follow_up_date, follow_up_note, first_contact_at, created_at, 
                    utm_source, utm_medium, utm_campaign, page_path
                ) VALUES (
                    ${lead.id}, ${lead.name}, ${lead.company}, ${lead.email}, ${lead.whatsapp}, ${lead.campaign_source}, ${lead.status}, 
                    ${targetColId}, ${lead.position}, ${TARGET_ORG_ID}, ${lead.notes}, ${lead.value}, 
                    ${lead.follow_up_date}, ${lead.follow_up_note}, ${lead.first_contact_at}, ${lead.created_at}, 
                    ${lead.utm_source}, ${lead.utm_medium}, ${lead.utm_campaign}, ${lead.page_path}
                ) ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    company = EXCLUDED.company,
                    email = EXCLUDED.email,
                    whatsapp = EXCLUDED.whatsapp,
                    campaign_source = EXCLUDED.campaign_source,
                    status = EXCLUDED.status,
                    column_id = EXCLUDED.column_id,
                    position = EXCLUDED.position,
                    organization_id = EXCLUDED.organization_id,
                    notes = EXCLUDED.notes,
                    value = EXCLUDED.value,
                    follow_up_date = EXCLUDED.follow_up_date,
                    follow_up_note = EXCLUDED.follow_up_note,
                    first_contact_at = EXCLUDED.first_contact_at,
                    utm_source = EXCLUDED.utm_source,
                    utm_medium = EXCLUDED.utm_medium,
                    utm_campaign = EXCLUDED.utm_campaign,
                    page_path = EXCLUDED.page_path
            `;
            count++;
        } catch (e: any) {
            console.error(`❌ Erro lead ${lead.id}:`, e.message);
        }
    }
    console.log(`✅ Leads migrados: ${count}`);

    // 3. History
    console.log("Migrating history...");
    const sourceHistory = await adminSql`
        SELECT * FROM lead_history 
        WHERE lead_id IN (SELECT id FROM leads WHERE organization_id = ANY(${SOURCE_ORG_IDS}))
    `;

    let hCount = 0;
    for (const hist of sourceHistory) {
        const fromCol = hist.from_column ? sourceIdToTargetId.get(hist.from_column) : null;
        const toCol = hist.to_column ? sourceIdToTargetId.get(hist.to_column) : null;

        try {
            await clientSql`
                INSERT INTO lead_history (
                    id, lead_id, action, from_column, to_column, user_id, details, created_at
                ) VALUES (
                    ${hist.id}, ${hist.lead_id}, ${hist.action}, ${fromCol}, ${toCol}, ${hist.user_id}, ${hist.details}, ${hist.created_at}
                ) ON CONFLICT (id) DO NOTHING
            `;
            hCount++;
        } catch (e: any) {
            // Silently skip if it fails for minor reasons but log major
        }
    }
    console.log(`✅ Histórico migrado: ${hCount}`);
    console.log("🏁 FIM.");
}

migrate().catch(err => {
    console.error("FATAL ERROR:", err);
});
