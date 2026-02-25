"use server";

import { db } from "@/lib/db";
import { launchLeads } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getLaunchLeads(organizationId: string) {
    try {
        const leads = await db.query.launchLeads.findMany({
            where: eq(launchLeads.organizationId, organizationId),
            orderBy: [desc(launchLeads.createdAt)],
        });

        return leads;
    } catch (error) {
        console.error("Error fetching launch leads:", error);
        throw new Error("Failed to fetch launch leads");
    }
}
