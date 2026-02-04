
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { users, members, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.warn("No .env.local found!");
}

// Dynamically import db after env is loaded
async function getDb() {
    const { db } = await import("@/lib/db");
    return db;
}

async function inspectUserPermissions(email: string) {
    console.log(`Starting inspection for: ${email}`);
    const db = await getDb();

    if (!email) {
        console.error("Please provide an email as argument");
        process.exit(1);
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        });

        if (!user) {
            console.log("❌ User NOT FOUND in database.");
            return;
        }

        console.log(`✅ User found: ${user.name} (${user.id})`);

        const userMemberships = await db.query.members.findMany({
            where: eq(members.userId, user.id)
        });

        console.log(`Found ${userMemberships.length} memberships.`);

        if (userMemberships.length === 0) {
            console.log("User has no memberships.");
        } else {
            console.log("Memberships:");
            for (const m of userMemberships) {
                const org = await db.query.organizations.findFirst({
                    where: eq(organizations.id, m.organizationId)
                });
                console.log(`- Organization: ${org?.name || m.organizationId} (Slug: ${org?.slug})`);
                console.log(`  Role: ${m.role}`);
                console.log(`  Member ID: ${m.id}`);
            }
        }
    } catch (error) {
        console.error("❌ Error querying database:", error);
    }
}

const emailArg = process.argv[2];
inspectUserPermissions(emailArg).then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
