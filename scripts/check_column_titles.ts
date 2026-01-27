
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function check() {
    console.log("🕵️ Investigating Column Titles...");

    const clientUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_ADMIN;

    if (!clientUrl || !adminUrl) {
        console.error("❌ URLs missing");
        process.exit(1);
    }

    const clientSql = neon(clientUrl);
    const adminSql = neon(adminUrl);

    // TARGET (Client DB - 'admin' org)
    const orgs = await clientSql`SELECT id FROM organizations WHERE slug = 'admin' LIMIT 1`;
    const targetOrgId = orgs[0].id;
    const targetCols = await clientSql`SELECT title, id, "order" FROM columns WHERE organization_id = ${targetOrgId} ORDER BY "order"`;

    // SOURCE (Admin DB)
    const SOURCE_IDS = ["bilder_agency_shared", "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5"];
    const sourceCols = await adminSql`SELECT title, id FROM columns WHERE organization_id = ANY(${SOURCE_IDS})`;

    console.log("\n📍 TARGET COLUMNS (Client DB):");
    targetCols.forEach((c: any) => console.log(` [${c.order}] "${c.title}"`));

    console.log("\n📍 SOURCE COLUMNS (Admin DB):");
    const uniqueSourceTitles = new Set(sourceCols.map((c: any) => c.title));
    uniqueSourceTitles.forEach(t => console.log(` - "${t}"`));

    console.log("\n⚖️ COMPARISON:");
    uniqueSourceTitles.forEach(sourceTitle => {
        const match = targetCols.find((tc: any) => String(tc.title).trim().toLowerCase() === String(sourceTitle).trim().toLowerCase());
        if (match) {
            console.log(` ✅ "${sourceTitle}" -> "${match.title}"`);
        } else {
            console.log(` ❌ "${sourceTitle}" -> NO MATCH (Will fallback to defaults)`);
        }
    });
}

check();
