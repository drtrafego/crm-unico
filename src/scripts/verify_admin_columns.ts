
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { columns } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";

async function main() {
    console.log("Loading environment...");
    // Dynamically import db to ensure env vars are loaded first
    const { adminDb } = await import("@/lib/db");
    console.log("Verifying Super Admin Columns...");

    try {
        const results = await adminDb.select().from(columns)
            .where(eq(columns.organizationId, 'super-admin-personal'))
            .orderBy(asc(columns.order));

        console.log("\n--- Super Admin Columns ---");
        if (results.length === 0) {
            console.log("No columns found for 'super-admin-personal'.");
        }
        results.forEach(c => {
            console.log(`[${c.order}] ${c.title} (ID: ${c.id})`);
        });
        console.log("---------------------------\n");
    } catch (e) {
        console.error("Error querying columns:", e);
        console.error(e);
    }
    process.exit(0);
}

main();
