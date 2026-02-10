
const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { pgTable, text, uuid, decimal, timestamp } = require("drizzle-orm/pg-core");
const fs = require('fs');

config({ path: ".env.local" });

const columns = pgTable("columns", {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
});

const leads = pgTable("leads", {
    id: uuid("id").primaryKey(),
    columnId: uuid("column_id"),
    name: text("name"),
    value: decimal("value"),
    notes: text("notes"),
    campaignSource: text("campaign_source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    pagePath: text("page_path"),
    status: text("status"),
    createdAt: timestamp("created_at")
});

async function main() {
    const db = drizzle(neon(process.env.DATABASE_URL));

    try {
        console.log("Fetching columns...");
        const allColumns = await db.select().from(columns);
        console.log(`Found ${allColumns.length} columns.`);

        console.log("Fetching leads...");
        const sampleLeads = await db.select().from(leads).limit(100).orderBy(leads.createdAt);
        console.log(`Found ${sampleLeads.length} leads.`);

        const output = {
            columns: allColumns,
            leads: sampleLeads
        };

        fs.writeFileSync('debug_output.json', JSON.stringify(output, null, 2));
        console.log("Data written to debug_output.json");
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
