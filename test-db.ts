import { db } from './src/lib/db';
import { vendasHotmart } from './src/server/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    try {
        const records = await db.select().from(vendasHotmart).orderBy(desc(vendasHotmart.createdAt)).limit(10);
        console.log("=== DB QUERY START ===");
        console.log(JSON.stringify(records, null, 2));
        console.log("=== DB QUERY END ===");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
main();
