import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM if needed, though we use process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // 1. Load Env
    const envPath = path.resolve(process.cwd(), '.env.local');
    console.log(`Loading env from: ${envPath}`);
    const envResult = dotenv.config({ path: envPath });
    
    if (envResult.error) {
        console.warn("⚠️  Warning: Could not load .env.local via dotenv. Checking process.env...");
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("\n❌ CRITICAL ERROR: DATABASE_URL is missing.");
        console.error(`   Please ensure '${envPath}' exists and contains DATABASE_URL.`);
        console.error("   Example: DATABASE_URL=\"postgres://user:pass@host/db\"\n");
        process.exit(1);
    }
    
    console.log("✅ DATABASE_URL found.");

    // 2. Dynamic Imports (avoids hoisting issues if schema relies on env or globals not yet ready)
    console.log("Importing dependencies...");
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { eq, and } = await import('drizzle-orm');
    
    // Import schema
    console.log("Importing schema...");
    const schema = await import('../src/server/db/schema.js').catch(async () => {
         // Fallback for tsx if extension resolution differs
         return await import('../src/server/db/schema');
    });

    const { organizations, members, users } = schema;

    // 3. Connect
    let connectionString = dbUrl;
    if (connectionString.startsWith('"') && connectionString.endsWith('"')) {
        connectionString = connectionString.slice(1, -1);
    }
    
    console.log("Connecting to database...");
    const sql = neon(connectionString);
    const db = drizzle(sql);

    const adminEmail = "dr.trafego@gmail.com";
    console.log(`Checking user: ${adminEmail}`);

    // 4. Logic
    const userList = await db.select().from(users).where(eq(users.email, adminEmail));
    const user = userList[0];

    if (!user) {
        console.error(`❌ User '${adminEmail}' not found.`);
        console.error("   Please sign in to the application at least once to create your user record, or insert manually.");
        process.exit(1);
    }
    console.log(`✅ User found: ${user.id}`);

    // Check Organization
    const orgSlug = "admin";
    const orgList = await db.select().from(organizations).where(eq(organizations.slug, orgSlug));
    let org = orgList[0];

    if (!org) {
        console.log(`Organization '${orgSlug}' not found. Creating...`);
        const inserted = await db.insert(organizations).values({
            name: "Casal do Tráfego",
            slug: orgSlug,
        }).returning();
        org = inserted[0];
        console.log(`✅ Organization created: ${org.id}`);
    } else {
        console.log(`✅ Organization '${orgSlug}' already exists.`);
    }

    // Check Member
    const memberList = await db.select().from(members).where(
        and(
            eq(members.userId, user.id),
            eq(members.organizationId, org.id)
        )
    );

    if (memberList.length === 0) {
        console.log("Adding user as owner...");
        await db.insert(members).values({
            userId: user.id,
            organizationId: org.id,
            role: "owner"
        });
        console.log("✅ User added as owner.");
    } else {
        console.log("✅ User is already a member.");
    }
    
    console.log("\n🎉 Seed completed successfully.");
}

main().catch((err) => {
    console.error("\n❌ Script failed with unhandled error:");
    console.error(err);
    process.exit(1);
});
