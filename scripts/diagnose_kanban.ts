
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function diagnose() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    console.log(`🔌 Connecting to DB...`);
    const sql = neon(clientUrl);
    const orgId = 'super-admin-personal'; // Target Org

    try {
        console.log(`\n🔍 Diagnosing for Organization: '${orgId}'`);

        // 1. Fetch Columns
        console.log("\n--- 1. Current Columns ---");
        const columns = await sql`SELECT id, title, "order" FROM columns WHERE organization_id = ${orgId} ORDER BY "order" ASC`;

        if (columns.length === 0) {
            console.warn("⚠️ No columns found for this organization!");
        } else {
            console.table(columns);
        }

        // 2. Count Leads per Column
        console.log("\n--- 2. Leads Distribution ---");
        const distribution = await sql`
            SELECT 
                c.title,
                c.id as column_id,
                COUNT(l.id) as lead_count
            FROM columns c
            LEFT JOIN leads l ON l.column_id = c.id AND l.organization_id = ${orgId}
            WHERE c.organization_id = ${orgId}
            GROUP BY c.id, c.title, c."order"
            ORDER BY c."order" ASC
        `;
        console.table(distribution);

        // 3. Find Orphaned Leads (No Column or Invalid Column)
        console.log("\n--- 3. Orphaned / Invalid Leads ---");

        // Leads with NULL column_id
        const nullColumnLeads = await sql`
            SELECT status, COUNT(*) as count
            FROM leads 
            WHERE organization_id = ${orgId} AND column_id IS NULL
            GROUP BY status
        `;
        console.log(`\n> Leads with NULL column_id (Grouped by Status):`);
        if (nullColumnLeads.length > 0) console.table(nullColumnLeads);


        // Leads with column_id that doesn't exist in columns table
        const invalidColumnLeads = await sql`
            SELECT l.id, l.name, l.column_id, l.created_at
            FROM leads l
            LEFT JOIN columns c ON l.column_id = c.id
            WHERE l.organization_id = ${orgId} AND c.id IS NULL AND l.column_id IS NOT NULL
        `;
        console.log(`\n> Leads with INVALID column_id (ID exists on lead but not in columns table): ${invalidColumnLeads.length}`);
        if (invalidColumnLeads.length > 0) {
            console.table(invalidColumnLeads.slice(0, 10));
            // Let's see if these IDs match any known columns from OTHER orgs (data leak?)
            const sampleInvalidId = invalidColumnLeads[0].column_id;
            const checkOther = await sql`SELECT * FROM columns WHERE id = ${sampleInvalidId}`;
            if (checkOther.length > 0) {
                console.log(`⚠️ FIRST INVALID ID BELONGS TO ORG: ${checkOther[0].organization_id} (Title: ${checkOther[0].title})`);
            }
        }

        // 4. Total Leads Check
        const totalLeads = await sql`SELECT count(*) FROM leads WHERE organization_id = ${orgId}`;
        console.log(`\n🏁 Total Leads in Org: ${totalLeads[0].count}`);

    } catch (e: any) {
        console.error("❌ SQL Error:", e.message);
    }
}

diagnose();
