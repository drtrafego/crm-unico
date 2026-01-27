
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function analyze() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    const sql = neon(clientUrl);
    const orgId = 'super-admin-personal';

    console.log(`\n🔍 Analyzing Data Recovery for: '${orgId}'`);

    try {
        // 1. Get Current Columns
        const columns = await sql`SELECT id, title, "order" FROM columns WHERE organization_id = ${orgId}`;
        const colMap = new Map(columns.map((c: any) => [c.title.toLowerCase().trim(), c.id]));
        console.log("\n--- Valid Columns ---");
        columns.forEach((c: any) => console.log(`[${c.order}] ${c.title}`));

        // 2. Analyze 'Status' Field Usage
        console.log("\n--- Unique 'Status' Values in Leads ---");
        const statuses = await sql`
            SELECT status, count(*) 
            FROM leads 
            WHERE organization_id = ${orgId}
            GROUP BY status
        `;

        console.table(statuses);

        // 3. Propose Mappings
        console.log("\n--- Proposed Mappings (Status -> Column) ---");
        for (const s of statuses) {
            const statusLower = s.status.toLowerCase().trim();
            let match = '❓ NO MATCH';

            // Exact or Fuzzy Matching logic
            if (colMap.has(statusLower)) {
                match = `✅ Exact Match: ${columns.find((c: any) => c.title.toLowerCase().trim() === statusLower)?.title || 'UNKNOWN'}`;
            } else if (statusLower === 'active') {
                match = `💡 Potential: Atendimento em Andamento (Active)`;
            } else if (statusLower === 'novo' || statusLower === 'new') {
                match = `💡 Potential: Novos Leads`;
            }

            console.log(`'${s.status}' (${s.count}) -> ${match}`);
        }

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }
}

analyze();
