
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function sync() {
    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_ADMIN;

    if (!clientUrl || !adminUrl) process.exit(1);

    const clientSql = neon(clientUrl);
    const adminSql = neon(adminUrl);

    console.log("🔄 Syncing Column Names & Order from Admin DB...");

    // 1. Get Authoritative Order from Admin DB
    // We use the 'bilder_agency_shared' or '5026...' org as source, whichever has the columns
    const SOURCE_IDS = ["bilder_agency_shared", "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5"];

    // Fetch columns from Admin, ordered correctly
    const adminCols = await adminSql`
        SELECT title, "order" 
        FROM columns 
        WHERE organization_id = ANY(${SOURCE_IDS}) 
        ORDER BY "order" ASC
    `;

    console.log(`\n📋 Found ${adminCols.length} columns in Admin DB (The correct order):`);
    adminCols.forEach((c: any) => console.log(` [${c.order}] ${c.title}`));

    // 2. Update Client DB
    const TARGET_ORG_SLUG = 'admin';
    const targetOrgRes = await clientSql`SELECT id FROM organizations WHERE slug = ${TARGET_ORG_SLUG}`;
    const targetOrgId = targetOrgRes[0].id;

    // Special mappings for the rename mistake I made
    const renames: Record<string, string> = {
        "Contato Realizado": "Em Contato" // Admin Title -> Current Client Title
    };

    for (const sourceCol of adminCols) {
        const adminTitle = sourceCol.title;
        const currentClientTitle = renames[adminTitle] || adminTitle;

        // Find the column in Client DB by its current name
        // We assume titles are unique per org
        const match = await clientSql`
            SELECT id FROM columns 
            WHERE organization_id = ${targetOrgId} 
            AND LOWER(title) = LOWER(${currentClientTitle})
        `;

        if (match.length > 0) {
            const colId = match[0].id;
            // Update Title (Restore original) and Order (Fix position)
            await clientSql`
                UPDATE columns 
                SET title = ${adminTitle}, "order" = ${sourceCol.order}
                WHERE id = ${colId}
            `;
            console.log(` ✅ Updated: "${currentClientTitle}" → "${adminTitle}" (Order: ${sourceCol.order})`);
        } else {
            console.log(` ⚠️ Missing in Client: "${adminTitle}". Creating it...`);
            await clientSql`
                INSERT INTO columns (organization_id, title, "order")
                VALUES (${targetOrgId}, ${adminTitle}, ${sourceCol.order})
            `;
        }
    }

    console.log("\n✨ Sync Complete.");
}

sync();
