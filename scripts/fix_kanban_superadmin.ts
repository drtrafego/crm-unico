
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function fix() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    console.log(`🔌 Connecting to DB...`);
    const sql = neon(clientUrl);
    const orgId = 'super-admin-personal';

    try {
        console.log(`\n🛠️ Fixing Kanban for: '${orgId}'`);

        // 1. Fix Column Orders (Re-sequence)
        console.log("\n--- 1. Re-sequencing Column Orders ---");
        const columns = await sql`SELECT id, title, "order" FROM columns WHERE organization_id = ${orgId} ORDER BY "order" ASC, title ASC`;

        let newOrder = 0;
        let novosLeadsId = '';

        for (const col of columns) {
            // Identify 'Novos Leads' for later
            if (col.title === 'Novos Leads') novosLeadsId = col.id;

            if (col.order !== newOrder) {
                console.log(`Updating '${col.title}': ${col.order} -> ${newOrder}`);
                await sql`UPDATE columns SET "order" = ${newOrder} WHERE id = ${col.id}`;
            } else {
                console.log(`OK '${col.title}': ${col.order}`);
            }
            newOrder++;
        }

        if (!novosLeadsId) {
            console.error("❌ 'Novos Leads' column not found! Aborting lead fix.");
            return;
        }

        // 2. Fix Orphaned Leads (Assign to 'Novos Leads')
        console.log(`\n--- 2. Fix Orphaned Leads (Target: ${novosLeadsId}) ---`);

        // Count before
        const beforeCount = await sql`SELECT count(*) FROM leads WHERE organization_id = ${orgId} AND column_id IS NULL`;
        console.log(`Orphaned Leads found: ${beforeCount[0].count}`);

        if (beforeCount[0].count > 0) {
            await sql`
                UPDATE leads 
                SET column_id = ${novosLeadsId} 
                WHERE organization_id = ${orgId} AND column_id IS NULL
            `;
            console.log("✅ Assigned orphaned leads to 'Novos Leads'.");
        } else {
            console.log("✅ No orphaned leads to fix.");
        }

    } catch (e: any) {
        console.error("❌ SQL Error:", e.message);
    }
}

fix();
