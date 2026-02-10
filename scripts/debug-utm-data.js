
const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { pgTable, text, integer, timestamp } = require("drizzle-orm/pg-core");

config({ path: ".env.local" });

const leads = pgTable("leads", {
    id: text("id").primaryKey(),
    name: text("name"),
    campaignSource: text("campaign_source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    columnId: text("column_id"),
    createdAt: timestamp("created_at"),
    notes: text("notes"),
});

const columns = pgTable("columns", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
});

async function main() {
    const db = drizzle(neon(process.env.DATABASE_URL));

    console.log("--- COLUMNS ---");
    const allColumns = await db.select().from(columns);
    allColumns.forEach(c => console.log(`${c.title} (${c.id})`));

    console.log("\n--- RECENT LEADS (SAMPLE 20) ---");
    const recentLeads = await db.select().from(leads).limit(20).orderBy(leads.createdAt);

    recentLeads.forEach(l => {
        const colTitle = allColumns.find(c => c.id === l.columnId)?.title || "Unknown";
        console.log(`Lead: ${l.name?.substring(0, 15)} | Source: ${l.campaignSource || l.utmSource || 'N/A'} | UTM Camp: ${l.utmCampaign || 'N/A'} | Status: ${colTitle} | Notes: ${l.notes ? l.notes.substring(0, 30) + '...' : 'Empty'}`);
    });
}

main();
