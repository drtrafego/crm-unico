
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function correct() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_ADMIN;

    if (!clientUrl || !adminUrl) process.exit(1);

    const clientSql = neon(clientUrl);
    const adminSql = neon(adminUrl);

    console.log("🛠️ Correcting Column Mappings...");

    // 1. Get Target 'Em Contato' ID
    const emContato = await clientSql`SELECT id FROM columns WHERE title = 'Em Contato' AND organization_id = (SELECT id FROM organizations WHERE slug = 'admin')`;

    if (emContato.length === 0) {
        console.error("❌ Target column 'Em Contato' not found.");
        return;
    }
    const targetId = emContato[0].id;
    console.log(`🎯 Target 'Em Contato' ID: ${targetId}`);

    // 2. Get Source 'Contato Realizado' ID
    // We need to know which old ID maps to this concept.
    // However, since we already migrated the leads, they are in the Client DB but probably with a NULL or wrong column_id.
    // Or, more likely, we need to look at the 'leads' in the admin db, see their ID, and update the corresponding lead in Client DB.

    // Better strategy:
    // Update leads in ClientDB where (status/notes/history) implies "Contato Realizado" but column is wrong?
    // Actually, the previous migration script would have mapped them to NULL or Fallback if no match found.

    // Let's re-migrate ONLY the leads that were in "Contato Realizado"
    const SOURCE_IDS = ["bilder_agency_shared", "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5"];

    const leadsToFix = await adminSql`
        SELECT l.id 
        FROM leads l
        JOIN columns c ON l.column_id = c.id
        WHERE c.title = 'Contato Realizado'
        AND l.organization_id = ANY(${SOURCE_IDS})
    `;

    console.log(`Found ${leadsToFix.length} leads to fix from 'Contato Realizado'.`);

    if (leadsToFix.length > 0) {
        const ids = leadsToFix.map((l: any) => l.id);

        // Update these IDs in Client DB to point to 'Em Contato'
        await clientSql`
            UPDATE leads 
            SET column_id = ${targetId}
            WHERE id = ANY(${ids})
        `;
        console.log("✅ Fixed.");
    }
}

correct();
