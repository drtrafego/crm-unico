
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function fix() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    const sql = neon(clientUrl);
    console.log("Applying Schema Fixes to Client DB...");

    try {
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_path TEXT`;
        console.log("✅ page_path added");

        await sql`ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS from_column TEXT`;
        await sql`ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS to_column TEXT`;
        console.log("✅ history columns added");

        console.log("🚀 Done.");
    } catch (e: any) {
        console.error("❌ SQL Error:", e.message);
    }
}

fix();
