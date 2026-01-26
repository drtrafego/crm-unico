
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

async function audit() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_ADMIN;

    if (!clientUrl || !adminUrl) {
        console.error("❌ Erro: URLs de banco de dados não encontradas no .env.local");
        process.exit(1);
    }

    const clientSql = neon(clientUrl);
    const adminSql = neon(adminUrl);

    // Function to get columns
    const getCols = async (sql: any, dbName: string) => {
        try {
            return await sql`
                SELECT table_name, column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                ORDER BY table_name, column_name
            `;
        } catch (e: any) {
            console.error(`Erro ao consultar ${dbName}:`, e.message);
            return [];
        }
    };

    const clientCols = await getCols(clientSql, 'ClientDB');
    const adminCols = await getCols(adminSql, 'AdminDB');

    // Organize by Table -> Columns
    const organize = (rows: any[]) => {
        const map = new Map<string, Set<string>>();
        rows.forEach(r => {
            if (!map.has(r.table_name)) map.set(r.table_name, new Set());
            map.get(r.table_name)?.add(`${r.column_name} (${r.data_type})`);
        });
        return map;
    };

    const clientMap = organize(clientCols);
    const adminMap = organize(adminCols);

    // Compare
    console.log("# 🔍 Relatório de Auditoria de Schema\n");
    console.log(`Data: ${new Date().toLocaleString()}\n`);

    const allTables = new Set([...Array.from(clientMap.keys()), ...Array.from(adminMap.keys())]);
    let hasIssues = false;

    console.log("## Resumo das Tabelas");
    const tableList = Array.from(allTables).sort();

    for (const table of tableList) {
        if (table.startsWith('_')) continue;

        const adminC = adminMap.get(table);
        const clientC = clientMap.get(table);

        if (adminC && clientC) {
            const missing = Array.from(adminC).filter(c => !clientC.has(c));
            if (missing.length === 0) {
                console.log(`- ✅ \`${table}\`: Sincronizada`);
            } else {
                console.log(`- ⚠️ \`${table}\`: Possui ${missing.length} colunas faltantes no Client DB`);
            }
        } else if (adminC && !clientC) {
            console.log(`- ❌ \`${table}\`: **Faltando no Client DB**`);
        } else if (!adminC && clientC) {
            console.log(`- ℹ️ \`${table}\`: Apenas no Client DB (Ignorado)`);
        }
    }

    console.log("\n## Detalhes das Diferenças");

    for (const table of tableList) {
        const adminC = adminMap.get(table);
        const clientC = clientMap.get(table);

        if (table.startsWith('_')) continue;

        if (adminC && !clientC) {
            console.log(`\n### ❌ Tabela Faltante: \`${table}\``);
            console.log(`> A tabela existe no Admin mas não no Client.`);
            const colList = Array.from(adminC).slice(0, 5).join(', ');
            console.log(`- Colunas (${adminC.size}): ${colList}${adminC.size > 5 ? '...' : ''}`);
            hasIssues = true;
            continue;
        }

        if (adminC && clientC) {
            const missingInClient = Array.from(adminC).filter(c => !clientC.has(c));

            if (missingInClient.length > 0) {
                console.log(`\n### ⚠️ Tabela: \`${table}\``);
                missingInClient.forEach(c => {
                    console.log(`- [ ] Adicionar coluna \`${c}\``);
                });
                hasIssues = true;
            }
        }
    }

    if (!hasIssues) {
        console.log("\n✅ **Tudo Sincronizado!** O Banco de Clientes tem todas as estruturas do Admin.");
    } else {
        console.log("\n---");
        console.log("Para corrigir, crie as migrations necessárias.");
    }
}

audit();
