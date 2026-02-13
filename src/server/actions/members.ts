'use server'

import { db } from "@/lib/db";
import { members, users, organizations, invitations } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-helper";

export async function addMember(email: string, orgId: string, role: 'admin' | 'editor' | 'viewer' = 'viewer') {
    const session = await getAuthenticatedUser();
    if (!session?.email) {
        throw new Error("Unauthorized");
    }

    // 1. Check if requester is admin/owner of the org
    const requester = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, session.id!)
        )
    });

    // Also allow Super Admins (from env) to add members
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    const isSuperAdmin = adminEmails.includes(session.email);

    if (!requester && !isSuperAdmin) {
        throw new Error("Permission denied");
    }

    // 2. Find the user by email
    let targetUser = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    if (!targetUser) {
        // Create invitation if user doesn't exist
        const existingInvite = await db.query.invitations.findFirst({
            where: and(
                eq(invitations.email, email),
                eq(invitations.organizationId, orgId),
                eq(invitations.status, 'pending')
            )
        });

        if (existingInvite) {
            throw new Error("Já existe um convite pendente para este email.");
        }

        await db.insert(invitations).values({
            email,
            organizationId: orgId,
            role,
            status: 'pending'
        });

        revalidatePath(`/org/${orgId}/settings`);
        return { status: "invited" };
    }

    // 3. Check if already member
    const existingMember = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, targetUser.id)
        )
    });

    if (existingMember) {
        throw new Error("Usuário já é membro da organização.");
    }

    // 4. Add member
    await db.insert(members).values({
        userId: targetUser.id,
        organizationId: orgId,
        role: role
    });

    revalidatePath(`/org/${orgId}/settings`);
    return { status: "added" };
}

export async function removeMember(memberId: string, orgId: string) {
    const session = await getAuthenticatedUser();
    if (!session?.id) {
        throw new Error("Unauthorized");
    }

    // 1. Check requester permissions
    const requester = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, session.id)
        )
    });

    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    const isSuperAdmin = adminEmails.includes(session.email || '');

    if ((!requester || (requester.role !== 'owner' && requester.role !== 'admin')) && !isSuperAdmin) {
        throw new Error("Permission denied");
    }

    // 2. Try to delete member
    const deletedMember = await db.delete(members)
        .where(and(eq(members.id, memberId), eq(members.organizationId, orgId)))
        .returning();

    // 3. If not a member, try to delete invitation
    if (deletedMember.length === 0) {
        await db.delete(invitations)
            .where(and(eq(invitations.id, memberId), eq(invitations.organizationId, orgId)));
    }

    revalidatePath(`/org/${orgId}/settings`);
}

export async function getMembers(orgId: string) {
    // Join members with users to get names and emails
    const orgMembers = await db
        .select({
            id: members.id,
            role: members.role,
            userId: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            joinedAt: members.createdAt,
            status: sql<'active'>`'active'` // Add status field for UI consistency
        })
        .from(members)
        .innerJoin(users, eq(members.userId, users.id))
        .where(eq(members.organizationId, orgId));

    // Fetch pending invitations
    const pendingInvites = await db
        .select({
            id: invitations.id,
            role: invitations.role,
            userId: sql<string>`'pending'`, // Placeholder
            name: sql<string>`'Convidado'`,
            email: invitations.email,
            image: sql<string>`''`,
            joinedAt: invitations.createdAt,
            status: sql<'pending'>`'pending'`
        })
        .from(invitations)
        .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, 'pending')));

    return [...orgMembers, ...pendingInvites];
}

export async function updateMemberRole(memberId: string, orgId: string, newRole: 'admin' | 'editor' | 'viewer' | 'owner') {
    const session = await getAuthenticatedUser();
    if (!session?.id) {
        throw new Error("Unauthorized");
    }

    // 1. Check requester permissions (must be owner or admin of the org)
    const requester = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, session.id)
        )
    });

    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    const isSuperAdmin = adminEmails.includes(session.email || '');

    if ((!requester || (requester.role !== 'owner' && requester.role !== 'admin')) && !isSuperAdmin) {
        throw new Error("Permission denied");
    }

    // 2. Prevent removing the last owner
    if (newRole !== 'owner') {
        const targetMember = await db.query.members.findFirst({
            where: eq(members.id, memberId)
        });

        if (targetMember?.role === 'owner') {
            const ownersCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(members)
                .where(and(eq(members.organizationId, orgId), eq(members.role, 'owner')));

            if (Number(ownersCount[0].count) <= 1) {
                throw new Error("Cannot change the role of the last owner");
            }
        }
    }

    // 3. Update Member Role
    await db.update(members)
        .set({ role: newRole })
        .where(eq(members.id, memberId));

    revalidatePath(`/org/${orgId}/settings`);
    return { status: "updated" };
}
