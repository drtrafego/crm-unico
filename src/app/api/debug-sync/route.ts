
import { db, adminDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const getColumns = async (database: any, dbName: string) => {
            return await database.execute(sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'leads' 
                AND table_schema = 'public'
                ORDER BY column_name;
            `);
        };

        const clientColumns = await getColumns(db, 'Client DB');
        const adminColumns = await getColumns(adminDb, 'Admin DB');

        return NextResponse.json({
            message: "Schema Comparison",
            client_db_leads_columns: clientColumns.rows,
            admin_db_leads_columns: adminColumns.rows,
            diff: {
                missing_in_admin: clientColumns.rows.filter((c: any) =>
                    !adminColumns.rows.some((a: any) => a.column_name === c.column_name)
                ),
                missing_in_client: adminColumns.rows.filter((a: any) =>
                    !clientColumns.rows.some((c: any) => c.column_name === a.column_name)
                )
            }
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
