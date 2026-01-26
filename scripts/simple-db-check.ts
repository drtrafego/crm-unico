import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("No DATABASE_URL");
        return;
    }
    console.log("Connecting...");
    const sql = neon(dbUrl);
    const db = drizzle(sql);

    console.log("Querying Organizations...");
    /* 
      We use raw sql to avoid schema definition mismatches causing errors
      if local schema is out of sync with actual DB tables.
    */
    try {
        const result = await sql`SELECT id, name, slug FROM organizations`;
        console.log("Organizations:", result);
    } catch (e: any) {
        console.error("Error querying organizations:", e.message);
    }

    try {
        const leads = await sql`SELECT id, organization_id, name FROM leads LIMIT 5`;
        console.log("Sample Leads:", leads);

        const count = await sql`SELECT organization_id, count(*) as count FROM leads GROUP BY organization_id`;
        console.log("Lead Counts by Org:", count);
    } catch (e: any) {
        console.error("Error querying leads:", e.message);
    }
}

main().catch(console.error);
