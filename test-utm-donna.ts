import { db } from "./src/lib/db";
import { leads, organizations } from "./src/server/db/schema";
import { desc, eq, ilike } from "drizzle-orm";

async function run() {
    const orgs = await db.query.organizations.findMany({
        where: ilike(organizations.name, '%donna domestica%')
    });

    if (orgs.length === 0) {
        console.log("Organização 'Donna Domestica' não encontrada!");
        process.exit(1);
    }

    const donnaOrgId = orgs[0].id;
    console.log(`Encontrado Org ID: ${donnaOrgId} - Nome: ${orgs[0].name}`);

    const recent = await db.query.leads.findMany({
        where: eq(leads.organizationId, donnaOrgId),
        orderBy: [desc(leads.createdAt)],
        limit: 5
    });

    console.log("=== ÚLTIMOS LEADS DIRECIONADOS (" + orgs[0].name.toUpperCase() + ") ===");
    recent.forEach(lead => {
        console.log(`Nome: ${lead.name}`);
        console.log(`Email: ${lead.email}`);
        console.log(`Criado em: ${lead.createdAt}`);
        console.log(`- Origem Sistêmica (campaignSource): ${lead.campaignSource}`);
        console.log(`- UTM Source: ${lead.utmSource}`);
        console.log(`- UTM Medium: ${lead.utmMedium}`);
        console.log(`- UTM Campaign: ${lead.utmCampaign}`);
        console.log(`- UTM Term: ${lead.utmTerm}`);
        console.log(`- UTM Content: ${lead.utmContent}`);
        console.log("-----------------------------------");
    });
    process.exit(0);
}

run().catch(console.error);
