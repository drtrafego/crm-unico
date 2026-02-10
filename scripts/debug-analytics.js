
const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { eq } = require("drizzle-orm");

config({ path: ".env.local" }); // Load env vars

// Helper to get DB connection
const getDb = (url) => {
    const sql = neon(url);
    return drizzle(sql);
};

// Define minimal schema for query
const { pgTable, text, timestamp, uuid, integer, boolean } = require("drizzle-orm/pg-core");

const leads = pgTable("leads", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    columnId: text("column_id"),
    campaignSource: text("campaign_source"),
    utmSource: text("utm_source"),
    name: text("name"),
});

const columns = pgTable("columns", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    title: text("title").notNull(),
    order: integer("order").notNull(),
});

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("DATABASE_URL not found");
        return;
    }
    const db = getDb(dbUrl);

    try {
        console.log("Fetching columns...");
        const allColumns = await db.select().from(columns);
        console.log("Columns found:", allColumns.map(c => ({ id: c.id, title: c.title, order: c.order })));

        console.log("\nFetching leads sample...");
        const sampleLeads = await db.select().from(leads).limit(10);
        console.log("Leads sample:", sampleLeads.map(l => ({
            id: l.id,
            source: l.campaignSource || l.utmSource,
            columnId: l.columnId
        })));

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
