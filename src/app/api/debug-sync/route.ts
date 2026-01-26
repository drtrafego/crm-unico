
import { db } from "@/lib/db";
import { organizations, leads } from "@/server/db/schema";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const orgs = await db.query.organizations.findMany();

        const orgStats = await Promise.all(orgs.map(async (org) => {
            const leadCount = await db
                .select({ count: count() })
                .from(leads)
                .where(eq(leads.organizationId, org.id));

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                count: leadCount[0].count
            };
        }));

        return NextResponse.json({
            message: "Debug Info",
            environment: process.env.NODE_ENV,
            adminEmails: process.env.ADMIN_EMAILS,
            organizations: orgStats
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
