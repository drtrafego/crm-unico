
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function recover() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    const sql = neon(clientUrl);
    const orgId = 'super-admin-personal';

    console.log(`\n🚑 Smart Recovery for: '${orgId}'`);

    try {
        // 1. Get Target Column ID for 'Atendimento em Andamento'
        const targetTitle = 'Atendimento em Andamento';
        const cols = await sql`SELECT id FROM columns WHERE organization_id = ${orgId} AND title = ${targetTitle}`;

        if (cols.length === 0) {
            console.error(`❌ Column '${targetTitle}' not found!`);
            return;
        }
        const targetId = cols[0].id;

        // 2. Identify Leads to Move (Status 'active')
        // We only move leads that are currently in 'Novos Leads' (or anywhere) BUT have status 'active'
        const leadsToMove = await sql`SELECT id FROM leads WHERE organization_id = ${orgId} AND status = 'active'`;
        console.log(`Found ${leadsToMove.length} leads with status 'active'.`);

        if (leadsToMove.length > 0) {
            // 3. Execute Update
            await sql`
                UPDATE leads 
                SET column_id = ${targetId} 
                WHERE organization_id = ${orgId} AND status = 'active'
            `;
            console.log(`✅ Moved ${leadsToMove.length} leads to '${targetTitle}'.`);
        } else {
            console.log("No leads to move.");
        }

    } catch (e: any) {
        console.error("❌ Link Error:", e.message);
    }
}

recover();
