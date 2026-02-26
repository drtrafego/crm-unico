import { db } from "./src/lib/db";
import { leads, organizations } from "./src/server/db/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
    const recentLeads = await db.query.leads.findMany({
        orderBy: [desc(leads.createdAt)],
        limit: 10,
        with: {
            organization: true
        }
    });

    console.log("=== 10 ÚLTIMOS LEADS GLOBAIS ===");
    recentLeads.forEach(lead => {
        console.log(`Org: ${lead.organization?.name || 'Desconhecida'} (ID: ${lead.organizationId})`);
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
