"use server";

import { db } from "@/lib/db";
import { organizations, leads, members, invitations, launchLeads, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
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
        features?: {
            hasLaunchDashboard?: boolean;
            launchSheetId?: string;
            launchSheetTabName?: string;
        };
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

export async function getOrganizationMembers(orgId: string) {
    try {
        await verifySuperAdmin();

        const activeMembers = await db
            .select({
                id: members.id,
                role: members.role,
                createdAt: members.createdAt,
                user: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    image: users.image,
                },
            })
            .from(members)
            .innerJoin(users, eq(members.userId, users.id))
            .where(eq(members.organizationId, orgId));

        const pendingInvitations = await db.query.invitations.findMany({
            where: eq(invitations.organizationId, orgId),
        });

        return { success: true, activeMembers, pendingInvitations };
    } catch (error) {
        console.error("Error fetching members:", error);
        return { success: false, error: "Falha ao buscar membros" };
    }
}

export async function addOrganizationMember(orgId: string, email: string, role: string) {
    try {
        await verifySuperAdmin();

        if (!email) throw new Error("Email é obrigatório");

        // Verificar se o usuário já existe
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
        });

        if (existingUser) {
            // Verificar se já é membro
            const existingMember = await db.query.members.findFirst({
                where: and(
                    eq(members.userId, existingUser.id),
                    eq(members.organizationId, orgId)
                ),
            });

            if (existingMember) {
                return { success: false, error: "Usuário já é membro desta organização" };
            }

            // Adicionar direto como membro
            await db.insert(members).values({
                userId: existingUser.id,
                organizationId: orgId,
                role: role as 'admin' | 'editor' | 'viewer',
            });
        } else {
            // Verificar se já tem convite
            const existingInvite = await db.query.invitations.findFirst({
                where: and(
                    eq(invitations.email, email.toLowerCase()),
                    eq(invitations.organizationId, orgId)
                ),
            });

            if (existingInvite) {
                return { success: false, error: "Convite já enviado para este email" };
            }

            // Criar convite
            await db.insert(invitations).values({
                email: email.toLowerCase(),
                organizationId: orgId,
                role: role as 'admin' | 'editor' | 'viewer',
            });
        }

        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error adding member:", error);
        return { success: false, error: error instanceof Error ? error.message : "Falha ao adicionar membro" };
    }
}

export async function removeOrganizationMember(memberId: string) {
    try {
        await verifySuperAdmin();
        await db.delete(members).where(eq(members.id, memberId));
        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error removing member:", error);
        return { success: false, error: "Falha ao remover membro" };
    }
}

export async function removeOrganizationInvitation(invitationId: string) {
    try {
        await verifySuperAdmin();
        await db.delete(invitations).where(eq(invitations.id, invitationId));
        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error removing invitation:", error);
        return { success: false, error: "Falha ao remover convite" };
    }
}

export async function updateMemberRole(memberId: string, role: string) {
    try {
        await verifySuperAdmin();
        await db.update(members)
            .set({ role: role as 'owner' | 'admin' | 'editor' | 'viewer' })
            .where(eq(members.id, memberId));
        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error updating member role:", error);
        return { success: false, error: "Falha ao atualizar permissão" };
    }
}

export async function updateUserInfo(userId: string, data: { name?: string; email?: string }) {
    try {
        await verifySuperAdmin();
        await db.update(users)
            .set({ ...data })
            .where(eq(users.id, userId));
        revalidatePath("/adm/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error updating user info:", error);
        return { success: false, error: "Falha ao atualizar informações do usuário" };
    }
}
