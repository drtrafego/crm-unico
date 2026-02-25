"use server";

import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getOrganizationFeatures(slug: string) {
    try {
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.slug, slug),
            columns: {
                features: true,
            }
        });

        return {
            hasLaunchDashboard: org?.features?.hasLaunchDashboard ?? false,
        };
    } catch (error) {
        console.error("Error fetching org features:", error);
        return { hasLaunchDashboard: false };
    }
}
