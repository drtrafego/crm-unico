
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { sql } from "drizzle-orm";

async function main() {
    console.log("Starting safe migration...");

    // Dynamic import to ensure env vars are loaded BEFORE db connection is established
    const { db } = await import("../src/lib/db");

    try {
        console.log("Adding utm_term...");
        await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term text;`);
        console.log("Added utm_term column.");
    } catch (e) {
        console.error("Error adding utm_term:", e);
    }

    try {
        console.log("Adding utm_content...");
        await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content text;`);
        console.log("Added utm_content column.");
    } catch (e) {
        console.error("Error adding utm_content:", e);
    }

    console.log("Migration complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
