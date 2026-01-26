import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL missing");
        process.exit(1);
    }

    console.log("Importing dependencies...");
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    // Basic import attempt, fallback handled if needed but standard import should work with tsx
    const schema = await import('../src/server/db/schema.js').catch(async () => await import('../src/server/db/schema'));

    // Deconstruct schema
    const { organizations, members, leads, columns, settings, leadHistory } = schema;

    // Connect
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.startsWith('"')) connectionString = connectionString.slice(1, -1);

    const sql = neon(connectionString);
    const db = drizzle(sql);

    console.log("Connected to DB.");

    // 1. Identify Target Org ID
    const TARGET_ID = "super-admin-personal";
    const TARGET_SLUG = "admin"; // As user requested "/adm" but code might expect "admin" or match slug.
    // wait, user said "slug do superadm vai ser /adm".
    // Let's check what the seed script created. It created slug="admin".

    // 2. Find existing Admin Org (by slug 'admin')
    const orgs = await db.select().from(organizations).where(eq(organizations.slug, "admin"));
    const adminOrg = orgs[0];

    if (!adminOrg) {
        console.error("❌ 'admin' organization not found. Did the seed script run?");
        process.exit(1);
    }

    console.log(`Found Admin Org: [${adminOrg.id}] "${adminOrg.name}"`);

    if (adminOrg.id === TARGET_ID) {
        console.log("✅ Organization ID is already correct.");
        process.exit(0);
    }

    // 3. Perform Migration
    const OLD_ID = adminOrg.id;
    console.log(`\n🚀 MIGRATING DATA from '${OLD_ID}' -> '${TARGET_ID}'...`);

    // A. Update Organization ID
    // Note: Drizzle update of PK might be tricky if it thinks valid.
    // If update fails, we insert new and delete old.

    try {
        await db.update(organizations)
            .set({ id: TARGET_ID })
            .where(eq(organizations.id, OLD_ID));
        console.log("✅ Updated Organization ID.");
    } catch (err) {
        console.error("Could not update Org ID directly (Constraint?):", err.message);
        // Fallback: Create new, move data, delete old
        const existingTarget = await db.select().from(organizations).where(eq(organizations.id, TARGET_ID));
        if (existingTarget.length === 0) {
            await db.insert(organizations).values({
                ...adminOrg,
                id: TARGET_ID
            });
            console.log("✅ Created new Organization with Target ID.");
        } else {
            console.log("ℹ️ Target Org already exists.");
        }
    }

    // B. Update Related Tables (Since schema has no foreign keys enforced at DB level usually for multi-tenant UUIDs here)
    // Tables: members, leads, columns, settings

    console.log("Updating dependent tables...");

    const r1 = await db.update(members)
        .set({ organizationId: TARGET_ID })
        .where(eq(members.organizationId, OLD_ID));
    // Drizzle doesn't return count easily in all drivers check, assuming success if no error
    console.log(" - Members updated.");

    const r2 = await db.update(leads)
        .set({ organizationId: TARGET_ID })
        .where(eq(leads.organizationId, OLD_ID));
    console.log(" - Leads updated.");

    const r3 = await db.update(columns)
        .set({ organizationId: TARGET_ID })
        .where(eq(columns.organizationId, OLD_ID));
    console.log(" - Columns updated.");

    const r4 = await db.update(settings)
        .set({ organizationId: TARGET_ID })
        .where(eq(settings.organizationId, OLD_ID));
    console.log(" - Settings updated.");

    // Clean up old if we did Insert-Move-Delete (if direct update failed logic above implies we need to clean up old only if we created new)
    // Actually, if direct update worked, OLD_ID row is gone (became NEW_ID).
    // If direct update failed, we created NEW, so OLD still exists.

    const checkOld = await db.select().from(organizations).where(eq(organizations.id, OLD_ID));
    if (checkOld.length > 0 && OLD_ID !== TARGET_ID) {
        console.log("Cleaning up old organization...");
        await db.delete(organizations).where(eq(organizations.id, OLD_ID));
    }

    console.log("\n🎉 Migration Complete. The Leads should now appear in the Dashboard.");
}

main().catch(err => {
    console.error("Script Error:", err);
    process.exit(1);
});
