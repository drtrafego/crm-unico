import fs from 'fs';
import { neon } from '@neondatabase/serverless';

async function main() {
    try {
        const env = fs.readFileSync('.env.local', 'utf-8');
        const match = env.match(/DATABASE_URL_CLIENTS="([^"]+)"/);
        if (!match) throw new Error("No DB URL found");

        const sql = neon(match[1]);
        const records = await sql`SELECT * FROM vendas_hotmart ORDER BY created_at DESC LIMIT 10`;
        console.log("=== DB QUERY START ===");
        console.log(JSON.stringify(records, null, 2));
        console.log("=== DB QUERY END ===");
    } catch (e) {
        console.error(e);
    }
}
main();
