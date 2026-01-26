import { db } from "@/lib/db";
import { organizations, members, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const adminEmail = "dr.trafego@gmail.com";

        // 1. Get User
        const user = await db.query.users.findFirst({
            where: eq(users.email, adminEmail)
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 2. Check/Create Organization
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

        // 3. Check/Add Member
        const member = await db.query.members.findFirst({
            where: (members, { and, eq }) => and(
                eq(members.userId, user.id),
                eq(members.organizationId, org.id)
            )
        });

        if (!member) {
            await db.insert(members).values({
                userId: user.id,
                organizationId: org.id,
                role: "owner"
            });
            console.log("Added user as owner");
        }

        return NextResponse.json({ success: true, org, member: member || "Created" });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
