
import { db } from "@/lib/db";
import { organizations, leads, leadHistory } from "@/server/db/schema";
import { count, eq, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const orgs = await db.query.organizations.findMany();

        const orgStats = await Promise.all(orgs.map(async (org) => {
            const leadCount = await db
                .select({ count: count() })
                .from(leads)
                .where(eq(leads.organizationId, org.id));

            const historyCount = await db
                .select({ count: count() })
                .from(leadHistory)
                .leftJoin(leads, eq(leadHistory.leadId, leads.id))
                .where(eq(leads.organizationId, org.id));

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                leadCount: leadCount[0].count,
                historyCount: historyCount[0]?.count || 0
            };
        }));

        // Raw SQL to list public tables
        const tableListResult = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);

        return NextResponse.json({
            message: "Debug Info v2",
            environment: process.env.NODE_ENV,
            tables: tableListResult.rows,
            organizations: orgStats
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
