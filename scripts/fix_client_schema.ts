
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function fix() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;

    if (!clientUrl) {
        console.error("❌ Erro: DATABASE_URL_CLIENTS não encontrada no .env.local");
        process.exit(1);
    }

    const clientSql = neon(clientUrl);

    console.log("Adicionando colunas faltantes ao Banco de Clientes...");

    try {
        // 1. Add page_path to leads
        await clientSql(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_path TEXT;`);
        console.log("✅ Coluna 'page_path' adicionada a 'leads'");

        // 2. Add from_column and to_column to lead_history
        // Using TEXT to match schema.ts (though information_schema said uuid in admin, 
        // Drizzle schema uses text for these currently)
        await clientSql(`ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS from_column TEXT;`);
        await clientSql(`ALTER TABLE lead_history ADD COLUMN IF NOT EXISTS to_column TEXT;`);
        console.log("✅ Colunas 'from_column' e 'to_column' adicionadas a 'lead_history'");

        console.log("\n🚀 Banco de Clientes agora está compatível com o Super Admin!");
    } catch (e: any) {
        console.error("❌ Erro ao aplicar alterações:", e.message);
    }
}

fix();
