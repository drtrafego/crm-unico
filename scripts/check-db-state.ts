import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Override process.env before imports if needed, but dynamic import is safer
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL missing");
        return;
    }

    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { organizations, leads, members, users } = await import('../src/server/db/schema.js').catch(async () => await import('../src/server/db/schema'));

    // Check Main DB
    checkDB("Main DB (DATABASE_URL)", process.env.DATABASE_URL, { neon, drizzle, organizations, leads, members, users });

    // Check Admin DB if different
    if (process.env.DATABASE_URL_SUPERADMIN && process.env.DATABASE_URL_SUPERADMIN !== process.env.DATABASE_URL) {
        console.log("\n--- Checking Super Admin DB ---");
        checkDB("Super Admin DB (DATABASE_URL_SUPERADMIN)", process.env.DATABASE_URL_SUPERADMIN, { neon, drizzle, organizations, leads, members, users });
    }
}

async function checkDB(label, connectionString, imports) {
    const { neon, drizzle, organizations, leads, members, users } = imports;

    if (connectionString.startsWith('"')) connectionString = connectionString.slice(1, -1);

    console.log(`\nConnecting to: ${label}`);
    const sql = neon(connectionString);
    const db = drizzle(sql);

    // 1. List Organizations
    const orgs = await db.select().from(organizations);
    console.log(`\nOrganizations Found: ${orgs.length}`);
    orgs.forEach(o => console.log(` - [${o.id}] "${o.name}" (Slug: ${o.slug})`));

    // 2. Count Leads per Org
    const allLeads = await db.select().from(leads);
    console.log(`\nTotal Leads Found: ${allLeads.length}`);

    const leadsByOrg = {};
    allLeads.forEach(l => {
        const oid = l.organizationId || "NULL";
        leadsByOrg[oid] = (leadsByOrg[oid] || 0) + 1;
    });

    Object.entries(leadsByOrg).forEach(([oid, count]) => {
        console.log(` - Org [${oid}]: ${count} leads`);
    });

    // 3. Check specific hardcoded ID
    const superAdminID = "super-admin-personal";
    const superOrg = orgs.find(o => o.id === superAdminID);
    if (!superOrg) {
        console.warn(`\n⚠️  The hardcoded ID '${superAdminID}' used in code does NOT exist in organizations table.`);
    } else {
        console.log(`\n✅ Hardcoded ID '${superAdminID}' exists.`);
    }

    console.log("------------------------------------------------");
}

main().catch(console.error);
