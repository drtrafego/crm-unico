
const { config } = require("dotenv");
const result = config({ path: ".env.local" });
console.log("Dotenv result:", result.error ? result.error : "Success");
console.log("DATABASE_URL_SUPERADMIN present:", !!process.env.DATABASE_URL_SUPERADMIN);

const { like, or, eq } = require("drizzle-orm");
// Import db after config
const { db, adminDb } = require("../src/lib/db");
const { leads } = require("../src/server/db/schema");

async function main() {
    console.log("Searching for debug leads...");

    // Search in regular DB
    console.log("\n--- Searching in Regular DB ---");
    const regularLeads = await db.select().from(leads).where(
        or(
            like(leads.name, "%Rayana%"),
            like(leads.name, "%Moivanm%")
        )
    );

    if (regularLeads.length === 0) console.log("No leads found in Regular DB.");
    regularLeads.forEach(l => {
        console.log(`[Regular DB] Found: ${l.name} | ID: ${l.id} | OrgID: ${l.organizationId} | Origin: '${l.campaignSource}'`);
    });

    // Search in Admin DB (if different connection, though usually same physical DB)
    console.log("\n--- Searching in Admin DB ---");
    const adminLeads = await adminDb.select().from(leads).where(
        or(
            like(leads.name, "%Rayana%"),
            like(leads.name, "%Moivanm%")
        )
    );

    if (adminLeads.length === 0) console.log("No leads found in Admin DB.");
    adminLeads.forEach(l => {
        console.log(`[Admin DB] Found: ${l.name} | ID: ${l.id} | OrgID: ${l.organizationId} | Origin: '${l.campaignSource}'`);
    });

    process.exit(0);
}

main().catch(console.error);
