
import { db, adminDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // 1. Check Schema (Did the update work?)
        const getColumns = async (database: any) => {
            return await database.execute(sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'leads' 
                AND table_schema = 'public'
                ORDER BY column_name;
            `);
        };
        const adminSchema = await getColumns(adminDb);

        // 2. Check Data Integrity (Admin DB)
        const orgId = 'super-admin-personal';

        const columns = await adminDb.execute(sql`
            SELECT id, title, "order" 
            FROM columns 
            WHERE organization_id = ${orgId} 
            ORDER BY "order" ASC
        `);

        const leadDistribution = await adminDb.execute(sql`
            SELECT column_id, count(*) as count 
            FROM leads 
            WHERE organization_id = ${orgId} 
            GROUP BY column_id
        `);

        // Check for leads with invalid/null column_id
        const orphanedLeads = await adminDb.execute(sql`
            SELECT count(*) as count 
            FROM leads 
            WHERE organization_id = ${orgId} 
            AND (column_id IS NULL OR column_id NOT IN (SELECT id FROM columns WHERE organization_id = ${orgId}))
        `);

        return NextResponse.json({
            message: "Deep Data Diagnostic",
            schema_status: {
                has_first_contact_at: adminSchema.rows.some((c: any) => c.column_name === 'first_contact_at'),
                total_columns_in_table: adminSchema.rows.length
            },
            data_status: {
                visible_kanban_columns: columns.rows,
                leads_by_column: leadDistribution.rows,
                orphaned_leads: orphanedLeads.rows[0].count
            }
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
