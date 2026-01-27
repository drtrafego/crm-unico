
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function verify() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    if (!clientUrl) {
        console.error("❌ DATABASE_URL_CLIENTS missing");
        process.exit(1);
    }

    console.log(`🔌 Conectando em: ${clientUrl.split('@')[1]} (Ocultando senha)`); // Show host to user
    const sql = neon(clientUrl);

    try {
        // 1. Check Tables
        const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log("\n📊 Tabelas encontradas no Banco:");
        tables.forEach((t: any) => console.log(` - ${t.table_name}`));

        // 2. Count Leads
        const count = await sql`SELECT count(*) FROM leads`;
        console.log(`\n📦 Total de Leads: ${count[0].count}`);

        // 3. Show Sample Migrated Leads (from Super Admin IDs)
        // We look for leads created recently or linked to the target org
        const leads = await sql`
            SELECT 
                l.id, 
                l.name, 
                l.organization_id, 
                l.created_at,
                c.title as column_title
            FROM leads l
            LEFT JOIN columns c ON l.column_id = c.id
            LIMIT 10
        `;
        console.log("\n🕵️ Amostra de Leads e suas Colunas (Top 10):");
        leads.forEach((l: any) => console.log(` - [${l.column_title || 'SEM COLUNA'}] ${l.name} (${new Date(l.created_at).toISOString()})`));

        // 4. Check specific columns
        const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'page_path'`;
        if (cols.length > 0) {
            console.log("\n✅ Coluna 'page_path' existe!");
        } else {
            console.error("\n❌ Coluna 'page_path' NÃO encontrada.");
        }

    } catch (e: any) {
        console.error("❌ SQL Error:", e.message);
    }
}

verify();
