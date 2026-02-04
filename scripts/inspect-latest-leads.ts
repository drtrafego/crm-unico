import { config } from "dotenv";
config({ path: ".env.local" });

import { desc } from "drizzle-orm";
// Use require for local modules to avoid hoisting issues preventing env loading
const { db } = require("../src/lib/db");
const { leads } = require("../src/server/db/schema");

const { eq } = require("drizzle-orm");

async function main() {
    console.log("Fetching latest 5 leads for Felipe Matias (a20d05cd-ea77-4456-8feb-586eeca3cfea)...");
    const recentLeads = await db.select().from(leads)
        .where(eq(leads.organizationId, 'a20d05cd-ea77-4456-8feb-586eeca3cfea'))
        .orderBy(desc(leads.createdAt))
        .limit(5);

    console.log("Found", recentLeads.length, "leads");

    for (const lead of recentLeads) {
        console.log("---------------------------------------------------");
        console.log(`ID: ${lead.id}`);
        console.log(`Name: ${lead.name}`);
        console.log(`Created At: ${lead.createdAt}`);
        console.log(`Campaign Source (DB): ${lead.campaignSource}`);
        console.log(`UTM Source: ${lead.utmSource}`);
        console.log(`UTM Medium: ${lead.utmMedium}`);
        console.log(`UTM Campaign: ${lead.utmCampaign}`);
        console.log(`Page Path: ${lead.pagePath}`);
        console.log("---------------------------------------------------");
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
