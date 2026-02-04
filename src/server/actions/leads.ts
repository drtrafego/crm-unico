'use server'

import { db } from "@/lib/db";
import { leads, columns, leadHistory, members, organizations, users } from "@/server/db/schema";
import { eq, asc, desc, and, ne, lt, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// Helper to determine which OrgID to use (Simplified: always use the provided orgId)
async function getContext(orgId: string) {
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { slug: true }
    });

    return {
        targetDb: db,
        targetOrgIds: [orgId],
        primaryOrgId: orgId,
        isSuperAdmin: org?.slug === "admin"
    };
}

async function checkPermissions(orgId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, session.user.id)
        )
    });

    if (!member) throw new Error("Not a member");
    if (member.role === 'viewer') throw new Error("Permission denied");

    return member;
}

async function logHistory(leadId: string, action: 'create' | 'move' | 'update', details: string, fromColumn?: string, toColumn?: string) {
    const session = await auth();
    try {
        await db.insert(leadHistory).values({
            leadId, action, details, fromColumn, toColumn, userId: session?.user?.id
        });
    } catch (error) {
        console.error("Failed to log history:", error);
    }
}

export async function getLeadHistory(leadId: string) {
    const history = await db.select({
        id: leadHistory.id,
        action: leadHistory.action,
        details: leadHistory.details,
        createdAt: leadHistory.createdAt,
        fromColumn: leadHistory.fromColumn,
        toColumn: leadHistory.toColumn,
        userName: users.name,
        userImage: users.image
    })
        .from(leadHistory)
        .leftJoin(users, eq(leadHistory.userId, users.id))
        .where(eq(leadHistory.leadId, leadId))
        .orderBy(desc(leadHistory.createdAt));

    return history;
}

export async function getColumns(orgId: string) {
    const { targetDb, primaryOrgId } = await getContext(orgId);

    const existing = await targetDb.query.columns.findMany({
        where: eq(columns.organizationId, primaryOrgId),
        orderBy: [asc(columns.order)],
    });

    if (existing.length === 0) {
        const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];
        const inserted = await targetDb.insert(columns).values(
            expectedTitles.map((title, i) => ({ title, organizationId: primaryOrgId, order: i }))
        ).returning();
        return inserted.sort((a, b) => a.order - b.order);
    }

    return existing.sort((a, b) => a.order - b.order);
}

export async function getLeads(orgId: string) {
    const { targetDb, primaryOrgId } = await getContext(orgId);

    return await targetDb.query.leads.findMany({
        where: eq(leads.organizationId, primaryOrgId),
        orderBy: [asc(leads.position), desc(leads.createdAt)],
    });
}

export async function deleteLead(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);
    await targetDb.delete(leads).where(and(eq(leads.id, id), eq(leads.organizationId, primaryOrgId)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateLeadStatus(id: string, newColumnId: string, newPosition: number, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    try {
        const lead = await targetDb.query.leads.findFirst({
            where: and(eq(leads.id, id), eq(leads.organizationId, primaryOrgId)),
        });

        if (lead) {
            // Log movement if column changed
            if (newColumnId !== lead.columnId) {
                const cols = await targetDb.query.columns.findMany({
                    where: inArray(columns.id, [lead.columnId || '', newColumnId]),
                    columns: { id: true, title: true }
                });
                const fromColTitle = cols.find(c => c.id === lead.columnId)?.title || "Unknown";
                const toColTitle = cols.find(c => c.id === newColumnId)?.title || "Unknown";

                await logHistory(lead.id, 'move', `Moveu de "${fromColTitle}" para "${toColTitle}"`, fromColTitle, toColTitle);
            }

            if (!lead.firstContactAt && newColumnId !== lead.columnId) {
                await targetDb.update(leads)
                    .set({ firstContactAt: new Date() })
                    .where(eq(leads.id, id));
            }

            await targetDb.update(leads)
                .set({ columnId: newColumnId, position: newPosition })
                .where(eq(leads.id, id));

            revalidatePath(`/org/${orgId}/kanban`);
        }
    } catch (error) {
        console.error("[updateLeadStatus] Error:", error);
        throw error;
    }
}

export async function createLead(formData: FormData, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    const whatsapp = formData.get("whatsapp") as string;
    const notes = formData.get("notes") as string;
    const value = formData.get("value") ? String(formData.get("value")) : null;

    const firstColumn = await targetDb.query.columns.findFirst({
        where: eq(columns.organizationId, primaryOrgId),
        orderBy: [asc(columns.order)],
    });

    if (!firstColumn) throw new Error("No columns found");

    const [newLead] = await targetDb.insert(leads).values({
        name, company, email, whatsapp, notes, value,
        status: 'active',
        columnId: firstColumn.id,
        organizationId: primaryOrgId,
        position: 0,
    }).returning();

    await logHistory(newLead.id, 'create', `Lead criado em ${firstColumn.title}`, undefined, firstColumn.id);
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function createColumn(title: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    const existing = await targetDb.query.columns.findMany({
        where: eq(columns.organizationId, primaryOrgId)
    });

    await targetDb.insert(columns).values({
        title,
        organizationId: primaryOrgId,
        order: existing.length,
    });
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumn(id: string, title: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    await targetDb.update(columns)
        .set({ title })
        .where(and(eq(columns.id, id), eq(columns.organizationId, primaryOrgId)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumnOrder(orderedIds: string[], orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    for (let i = 0; i < orderedIds.length; i++) {
        await targetDb.update(columns)
            .set({ order: i })
            .where(and(eq(columns.id, orderedIds[i]), eq(columns.organizationId, primaryOrgId)));
    }
    revalidatePath(`/org/${orgId}/kanban`);

    const updatedColumns = await getColumns(orgId);
    return { success: true, columns: updatedColumns };
}

export async function deleteColumn(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    const col = await targetDb.query.columns.findFirst({ where: eq(columns.id, id) });
    if (!col) return;

    // Check if there are leads in this column
    const leadsInColumn = await targetDb.query.leads.findMany({
        where: eq(leads.columnId, id),
        columns: { id: true }
    });

    if (leadsInColumn.length > 0) {
        // Find a fallback column (first available that is NOT the one being deleted)
        const fallbackColumn = await targetDb.query.columns.findFirst({
            where: and(
                eq(columns.organizationId, primaryOrgId),
                ne(columns.id, id)
            ),
            orderBy: [asc(columns.order)]
        });

        if (!fallbackColumn) {
            throw new Error("Cannot delete the only column with existing leads.");
        }

        // Move all leads to the fallback column
        await targetDb.update(leads)
            .set({ columnId: fallbackColumn.id })
            .where(eq(leads.columnId, id));
    }

    await targetDb.delete(columns).where(eq(columns.id, id));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateLeadContent(id: string, data: Partial<typeof leads.$inferInsert>, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, primaryOrgId } = await getContext(orgId);

    const allowedFields: (keyof typeof leads.$inferInsert)[] = [
        'name', 'company', 'email', 'whatsapp', 'notes', 'value',
        'campaignSource', 'followUpDate', 'followUpNote'
    ];
    const payload: any = {};
    allowedFields.forEach(k => { if (data[k] !== undefined) payload[k] = data[k]; });

    if (payload.value === '') payload.value = null;

    if (data.columnId) payload.columnId = data.columnId;
    if (data.position !== undefined) payload.position = data.position;

    // Check for changes and log history
    if (id) {
        const currentLead = await targetDb.query.leads.findFirst({
            where: eq(leads.id, id)
        });

        if (currentLead) {
            const changes: string[] = [];

            if (payload.value !== undefined && Number(payload.value) !== Number(currentLead.value)) {
                changes.push(`Valor alterado de ${currentLead.value || 0} para ${payload.value}`);
            }
            if (payload.notes !== undefined && payload.notes !== currentLead.notes) {
                changes.push(`Observações atualizadas`);
            }
            if (payload.campaignSource !== undefined && payload.campaignSource !== currentLead.campaignSource) {
                changes.push(`Origem alterada de ${currentLead.campaignSource || 'N/A'} para ${payload.campaignSource}`);
            }
            if (payload.followUpDate !== undefined) {
                const oldDate = currentLead.followUpDate ? new Date(currentLead.followUpDate).toISOString().split('T')[0] : 'N/A';
                const newDate = payload.followUpDate ? new Date(payload.followUpDate).toISOString().split('T')[0] : 'N/A';
                if (oldDate !== newDate) changes.push(`Data de retorno: ${oldDate} -> ${newDate}`);
            }

            if (changes.length > 0) {
                await logHistory(id, 'update', changes.join('; '));
            }
        }
    }

    await targetDb.update(leads)
        .set(payload)
        .where(eq(leads.id, id));

    revalidatePath(`/org/${orgId}/kanban`);
}
