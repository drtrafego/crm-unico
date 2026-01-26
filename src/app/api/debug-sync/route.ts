
import { db, adminDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Broad Scan: Group all leads by organization_id to see where data actually lives

        // 1. Scan ADMIN DB
        const adminScan = await adminDb.execute(sql`
            SELECT organization_id, count(*) as count 
            FROM leads 
            GROUP BY organization_id
        `);

        // 2. Scan CLIENT DB
        const clientScan = await db.execute(sql`
            SELECT organization_id, count(*) as count 
            FROM leads 
            GROUP BY organization_id
        `);

        // 3. Get Organization Names for context
        const orgs = await db.execute(sql`SELECT id, name, slug FROM organizations`);

        return NextResponse.json({
            message: "Global Data Scan",
            super_admin_db_leads: adminScan.rows,
            client_db_leads: clientScan.rows,
            organizations_ref: orgs.rows
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
