import { db } from "@/lib/db";
import { organizations, members, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
        const results = [];

        // 1. Check/Create Organization (Done once)
        let org = await db.query.organizations.findFirst({
            where: eq(organizations.slug, "admin")
        });

        if (!org) {
            const [newOrg] = await db.insert(organizations).values({
                name: "Casal do Tráfego",
                slug: "admin",
            }).returning();
            org = newOrg;
            console.log("Created Organization: Casal do Tráfego");
        } else {
            console.log("Organization already exists");
        }

        // 2. Process each admin
        for (const email of adminEmails) {
            const cleanEmail = email.trim();
            if (!cleanEmail) continue;

            const user = await db.query.users.findFirst({
                where: eq(users.email, cleanEmail)
            });

            if (!user) {
                results.push({ email: cleanEmail, status: "User not found" });
                continue;
            }

            const member = await db.query.members.findFirst({
                where: (members, { and, eq }) => and(
                    eq(members.userId, user.id),
                    eq(members.organizationId, org!.id)
                )
            });

            if (!member) {
                await db.insert(members).values({
                    userId: user.id,
                    organizationId: org!.id,
                    role: "owner"
                });
                results.push({ email: cleanEmail, status: "Added as owner" });
            } else {
                // Determine if we need to upgrade role (optional, but requested "same powers")
                if (member.role !== "owner") {
                    await db.update(members)
                        .set({ role: "owner" })
                        .where(eq(members.id, member.id));
                    results.push({ email: cleanEmail, status: " upgraded to owner" });
                } else {
                    results.push({ email: cleanEmail, status: "Already owner" });
                }
            }
        }

        return NextResponse.json({ success: true, org, results });

    } catch (error: unknown) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
