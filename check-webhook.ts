import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './src/server/db/schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use BI_DATABASE_URL to match our Neon push
const sql = neon(process.env.BI_DATABASE_URL || process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function checkWebhook() {
    try {
        console.log("Checando vendas recebidas no banco de dados...\n");
        const vendas = await db.select().from(schema.vendasHotmart).limit(5);

        if (vendas.length === 0) {
            console.log("Nenhuma venda encontrada na tabela.");
        } else {
            console.log(`Encontrei ${vendas.length} venda(s):`);
            console.log(JSON.stringify(vendas, null, 2));
        }

    } catch (error) {
        console.error("Erro ao ler do banco:", error);
    }
}

checkWebhook();
