"use server";

import { db } from "@/lib/db";
import { organizations, leads, members, invitations, launchLeads } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { revalidatePath } from "next/cache";

async function verifySuperAdmin() {
    const session = await getAuthenticatedUser();
    const userEmail = session?.email;
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];

    if (!userEmail || !adminEmails.includes(userEmail)) {
        throw new Error("Unauthorized");
    }
}

export async function updateOrganization(
    id: string,
    data: {
        name?: string;
        slug?: string;
        features?: { hasLaunchDashboard?: boolean };
    }
) {
    try {
        await verifySuperAdmin();

        await db.update(organizations)
            .set({
                ...data,
            })
            .where(eq(organizations.id, id));

        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error updating organization:", error);
        return { success: false, error: "Failed to update organization" };
    }
}

export async function deleteOrganization(id: string) {
    try {
        await verifySuperAdmin();

        // Drizzle ORM does not automatically cascade deletes unless set up in the schema constraints perfectly.
        // For safety, we manually delete dependencies or ensure onDelete cascade is working.
        // Assuming onDelete cascade is not fully covering launchLeads and others, we delete them first.

        await db.delete(launchLeads).where(eq(launchLeads.organizationId, id));
        await db.delete(leads).where(eq(leads.organizationId, id));
        await db.delete(members).where(eq(members.organizationId, id));
        await db.delete(invitations).where(eq(invitations.organizationId, id));

        // Finally delete org
        await db.delete(organizations).where(eq(organizations.id, id));

        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error deleting organization:", error);
        return { success: false, error: "Failed to delete organization" };
    }
}
