
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function check() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    const sql = neon(clientUrl);
    const slug = 'locadora-da-construo';

    console.log(`\n🔍 Checking Organization: '${slug}'`);

    try {
        // 1. Check DB Time
        const dbTime = await sql`SELECT now()`;
        console.log(`⏰ DB Time: ${dbTime[0].now}`);

        // 2. Search for recent leads across ALL orgs
        console.log("\n🔍 Recent Leads (All Orgs):");
        const recentLeads = await sql`
            SELECT 
                l.id, 
                l.name, 
                l.whatsapp, 
                l.email, 
                l.notes, 
                l.campaign_source,
                l.created_at
            FROM leads l
            ORDER BY l.created_at DESC
            LIMIT 1
        `;
        // Pretty print the single latest lead object
        if (recentLeads.length > 0) {
            console.log("📦 Full Lead Data:");
            console.log(JSON.stringify(recentLeads[0], null, 2));
        } else {
            console.log("No leads found.");
        }

    } catch (e: any) {
        console.error("❌ DB Error:", e.message);
    }
}

check();
