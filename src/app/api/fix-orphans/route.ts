
import { adminDb } from "@/lib/db";
import { columns, leads } from "@/server/db/schema";
import { eq, asc, sql, and, isNull, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const SUPER_ADMIN_ORG_ID = "super-admin-personal";

export async function GET() {
    try {
        const results = [];

        // 1. Ensure Columns Exist
        let existingColumns = await adminDb.query.columns.findMany({
            where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
            orderBy: [asc(columns.order)],
        });

        if (existingColumns.length === 0) {
            results.push("No columns found. Creating defaults...");
            const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];

            await adminDb.insert(columns).values(
                expectedTitles.map((title, i) => ({
                    title,
                    organizationId: SUPER_ADMIN_ORG_ID,
                    order: i
                }))
            );

            // Re-fetch
            existingColumns = await adminDb.query.columns.findMany({
                where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
                orderBy: [asc(columns.order)],
            });
            results.push(`Created ${existingColumns.length} default columns.`);
        } else {
            results.push(`Found ${existingColumns.length} existing columns.`);
        }

        const firstColumnId = existingColumns[0].id;
        const validColumnIds = existingColumns.map(c => c.id);

        // 2. Identify Orphans (Leads with NULL or Invalid Column ID)
        // Using raw SQL for safety and clarity in the WHERE NOT IN clause
        const orphansCheck = await adminDb.execute(sql`
            SELECT count(*) as count 
            FROM leads 
            WHERE organization_id = ${SUPER_ADMIN_ORG_ID} 
            AND (column_id IS NULL OR column_id NOT IN (SELECT id FROM columns WHERE organization_id = ${SUPER_ADMIN_ORG_ID}))
        `);

        const orphanCount = orphansCheck.rows[0].count;
        results.push(`Found ${orphanCount} orphaned leads.`);

        if (Number(orphanCount) > 0) {
            // 3. Fix Orphans
            const updateResult = await adminDb.execute(sql`
                UPDATE leads 
                SET column_id = ${firstColumnId}, position = 0
                WHERE organization_id = ${SUPER_ADMIN_ORG_ID} 
                AND (column_id IS NULL OR column_id NOT IN (SELECT id FROM columns WHERE organization_id = ${SUPER_ADMIN_ORG_ID}))
            `);
            // Note: Drizzle execute result format depends on driver, assume successful if no error throw
            results.push(`Moved orphans to column: ${existingColumns[0].title} (${firstColumnId})`);
        } else {
            results.push("No orphans to fix.");
        }

        return NextResponse.json({
            success: true,
            messsage: "Orphan Fix Report",
            details: results
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
