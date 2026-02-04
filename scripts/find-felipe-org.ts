import { config } from "dotenv";
config({ path: ".env.local" });

import { like, or } from "drizzle-orm";
const { db } = require("../src/lib/db");
const { organizations } = require("../src/server/db/schema");

async function main() {
    console.log("Searching for organization 'Felipe'...");
    const orgs = await db.select().from(organizations).where(
        or(
            like(organizations.name, "%Felipe%"),
            like(organizations.slug, "%felipe%")
        )
    );

    console.log("Found", orgs.length, "organizations");
    orgs.forEach(o => {
        console.log(`ID: ${o.id}, Name: ${o.name}, Slug: ${o.slug}`);
    });
    process.exit(0);
}

main().catch(console.error);
