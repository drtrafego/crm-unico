'use server'

import { db, adminDb } from "@/lib/db";
import { leads, columns, leadHistory, members, organizations } from "@/server/db/schema";
import { eq, asc, desc, and, ne, lt, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// Added both IDs provided by the user
const SUPER_ADMIN_DB_ORG_IDS = ["bilder_agency_shared", "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5"];

// Helper to determine which DB and OrgIDs to use
async function getContext(orgId: string) {
    // Check if this is the "admin" organization (Casal do Tráfego)
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { slug: true }
    });

    const isSuperAdmin = org?.slug === "admin";

    return {
        // If super admin, use adminDb, otherwise client db
        targetDb: isSuperAdmin ? adminDb : db,
        // If super admin, use the mapped IDs. Otherwise usage the single orgId (wrapped in array for consistency)
        targetOrgIds: isSuperAdmin ? SUPER_ADMIN_DB_ORG_IDS : [orgId],
        isSuperAdmin
    };
}

async function checkPermissions(orgId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // We always check permissions against the Client DB where 'members' and 'organizations' live
    // This authenticates the user regardless of where the data lives
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgId),
            eq(members.userId, session.user.id)
        )
    });

    if (!member) throw new Error("Not a member");

    // Viewers cannot modify data
    if (member.role === 'viewer') {
        throw new Error("Permission denied: Viewers cannot modify data");
    }

    return member;
}

// Helper to log history
async function logHistory(
    leadId: string,
    action: 'create' | 'move' | 'update',
    details: string,
    fromColumn?: string,
    toColumn?: string,
    contextDb: typeof db = db // Inject the correct DB
) {
    const session = await auth();
    const userId = session?.user?.id;

    await contextDb.insert(leadHistory).values({
        leadId,
        action,
        details,
        fromColumn,
        toColumn,
        userId
    });
}

export async function getLeadHistory(leadId: string) {
    // This is tricky because we don't have orgId passed here usually.
    // However, leadId should be unique UUID. We can try both or search primarily in one.

    let history = await db.select().from(leadHistory)
        .where(eq(leadHistory.leadId, leadId))
        .orderBy(desc(leadHistory.createdAt));

    if (history.length === 0) {
        const adminHistory = await adminDb.select().from(leadHistory)
            .where(eq(leadHistory.leadId, leadId))
            .orderBy(desc(leadHistory.createdAt));
        if (adminHistory.length > 0) return adminHistory;
    }

    return history;
}

// --- Refactored Actions for Multi-tenant ---

export async function getColumns(orgId: string) {
    const { targetDb, targetOrgIds } = await getContext(orgId);

    // Fetch existing columns matching ANY of the target IDs
    const existing = await targetDb.query.columns.findMany({
        where: inArray(columns.organizationId, targetOrgIds),
        orderBy: [asc(columns.order)],
    });

    const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];

    // 1. Handle empty state - Only initialize if NO columns exist
    if (existing.length === 0) {
        // Create columns for the FIRST target ID (primary) as default
        const primaryId = targetOrgIds[0];
        const inserted = await targetDb.insert(columns).values(
            expectedTitles.map((title, i) => ({
                title,
                organizationId: primaryId,
                order: i
            }))
        ).returning();
        return inserted.sort((a, b) => a.order - b.order);
    }

    // Return existing columns as-is, just sorted
    return existing.sort((a, b) => a.order - b.order);
}

export async function deleteLead(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    await targetDb.delete(leads).where(and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function getLeads(orgId: string) {
    const { targetDb, targetOrgIds } = await getContext(orgId);

    return await targetDb.query.leads.findMany({
        where: inArray(leads.organizationId, targetOrgIds),
        orderBy: [asc(leads.position), desc(leads.createdAt)],
    });
}

export async function updateLeadStatus(id: string, newColumnId: string, newPosition: number, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    console.log(`[Move] Lead: ${id} -> Col: ${newColumnId} (Pos: ${newPosition}) on Orgs: ${targetOrgIds.join(', ')}`);

    try {
        const lead = await targetDb.query.leads.findFirst({
            where: and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)),
        });

        if (lead) {
            if (!lead.firstContactAt && newColumnId !== lead.columnId) {
                await targetDb.update(leads)
                    .set({ firstContactAt: new Date() })
                    .where(eq(leads.id, id));
            }

            // Log History if column changed
            if (newColumnId !== lead.columnId) {
                const newCol = await targetDb.query.columns.findFirst({
                    where: eq(columns.id, newColumnId)
                });

                await logHistory(
                    id,
                    'move',
                    `Movido para ${newCol?.title || 'nova coluna'}`,
                    lead.columnId || undefined,
                    newColumnId,
                    targetDb
                );
            }
        }

        await targetDb.update(leads)
            .set({
                columnId: newColumnId,
                position: newPosition
            })
            .where(and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)));

        revalidatePath(`/org/${orgId}/kanban`);
        console.log(`[updateLeadStatus] Success`);
    } catch (error) {
        console.error("[updateLeadStatus] Error:", error);
        throw error;
    }
}

export async function createLead(formData: FormData, orgId: string) {
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    const whatsapp = formData.get("whatsapp") as string;
    const notes = formData.get("notes") as string;
    const valueStr = formData.get("value") as string;
    const value = valueStr ? valueStr : null;

    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    // Always use the first ID for new creations to maintain consistency
    const primaryOrgId = targetOrgIds[0];

    console.log(`[createLead] Creating lead for Org: ${orgId} (Target Primary: ${primaryOrgId})`);

    // Get the first column to add the lead to
    const firstColumn = await targetDb.query.columns.findFirst({
        where: inArray(columns.organizationId, targetOrgIds),
        orderBy: [asc(columns.order)],
    });

    if (!firstColumn) {
        throw new Error("No columns found");
    }

    const [newLead] = await targetDb.insert(leads).values({
        name,
        company,
        email,
        whatsapp,
        notes,
        value,
        status: 'active',
        columnId: firstColumn.id,
        organizationId: primaryOrgId,
        position: 0, // Add to top
    }).returning();

    await logHistory(newLead.id, 'create', `Lead criado em ${firstColumn.title}`, undefined, firstColumn.id, targetDb);

    revalidatePath(`/org/${orgId}/kanban`);
}

export async function createColumn(title: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);
    const primaryOrgId = targetOrgIds[0];

    console.log(`[createColumn] Org: ${orgId} | Title: ${title}`);
    const existingColumns = await getColumns(orgId); // Uses the new getColumns logic

    await targetDb.insert(columns).values({
        title,
        organizationId: primaryOrgId,
        order: existingColumns.length,
    });

    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumn(id: string, title: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    console.log(`[updateColumn] Org: ${orgId} | Col: ${id} -> Title: ${title}`);
    await targetDb.update(columns)
        .set({ title })
        .where(and(eq(columns.id, id), inArray(columns.organizationId, targetOrgIds)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumnOrder(orderedIds: string[], orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    console.log(`[updateColumnOrder] Org: ${orgId} | New Order:`, orderedIds);

    try {
        // Process updates sequentially
        for (let i = 0; i < orderedIds.length; i++) {
            const result = await targetDb.update(columns)
                .set({ order: i })
                // Match against ANY of the valid Org IDs
                .where(and(eq(columns.id, orderedIds[i]), inArray(columns.organizationId, targetOrgIds)))
                .returning({ id: columns.id });

            if (result.length === 0) {
                console.warn(`[updateColumnOrder] Warning: No column updated for ID ${orderedIds[i]} (Index ${i})`);
            }
        }

        revalidatePath(`/org/${orgId}/kanban`);
        console.log(`[updateColumnOrder] Success`);

        const updatedColumns = await targetDb.query.columns.findMany({
            where: inArray(columns.organizationId, targetOrgIds),
            orderBy: [asc(columns.order)],
        });

        return { success: true, columns: updatedColumns };
    } catch (error) {
        console.error("[updateColumnOrder] Error:", error);
        throw error;
    }
}

export async function deleteColumn(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    // Get the column being deleted to know its order
    const columnToDelete = await targetDb.query.columns.findFirst({
        where: eq(columns.id, id)
    });

    if (!columnToDelete) return; // Already deleted

    // Find a fallback column
    let fallbackCol = await targetDb.query.columns.findFirst({
        where: and(
            inArray(columns.organizationId, targetOrgIds),
            ne(columns.id, id),
            lt(columns.order, columnToDelete.order) // Less than
        ),
        orderBy: [desc(columns.order)]
    });

    if (!fallbackCol) {
        fallbackCol = await targetDb.query.columns.findFirst({
            where: and(
                inArray(columns.organizationId, targetOrgIds),
                ne(columns.id, id),
                gt(columns.order, columnToDelete.order) // Greater than
            ),
            orderBy: [asc(columns.order)]
        });
    }

    if (!fallbackCol) {
        throw new Error("Cannot delete the last column. At least one column must remain.");
    }

    // Move leads to the fallback column
    await targetDb.update(leads)
        .set({ columnId: fallbackCol.id })
        .where(eq(leads.columnId, id));

    // Delete the column
    await targetDb.delete(columns).where(and(eq(columns.id, id), inArray(columns.organizationId, targetOrgIds)));

    // Reorder remaining columns
    const remainingColumns = await targetDb.query.columns.findMany({
        where: inArray(columns.organizationId, targetOrgIds),
        orderBy: [asc(columns.order)]
    });

    for (let i = 0; i < remainingColumns.length; i++) {
        await targetDb.update(columns)
            .set({ order: i })
            .where(eq(columns.id, remainingColumns[i].id));
    }

    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateLeadContent(id: string, data: Partial<typeof leads.$inferInsert>, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    const allowedFields: (keyof typeof leads.$inferInsert)[] = [
        'name', 'company', 'email', 'whatsapp', 'notes', 'value',
        'campaignSource', 'followUpDate', 'followUpNote'
    ];

    const updatePayload: Partial<typeof leads.$inferInsert> = {};

    for (const key of allowedFields) {
        if (data[key] !== undefined) {
            // @ts-expect-error - dynamic assignment
            updatePayload[key] = data[key];
        }
    }

    if (typeof updatePayload.value === 'string' && updatePayload.value.trim() === '') {
        updatePayload.value = null;
    } else if (updatePayload.value === "") {
        updatePayload.value = null;
    }

    console.log(`Updating lead content ${id} with payload:`, updatePayload);

    const existingLead = await targetDb.query.leads.findFirst({
        where: and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)),
        columns: { id: true, columnId: true, position: true }
    });

    if (!existingLead) {
        console.error(`Lead ${id} not found for update`);
        return;
    }

    if (data.columnId !== undefined) {
        updatePayload.columnId = data.columnId;
    } else {
        updatePayload.columnId = existingLead.columnId;
    }

    if (data.position !== undefined) {
        updatePayload.position = data.position;
    } else {
        updatePayload.position = existingLead.position;
    }

    await targetDb.update(leads)
        .set(updatePayload)
        .where(and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)));

    const changedFields = Object.keys(updatePayload).filter(k => k !== 'columnId' && k !== 'position');
    if (changedFields.length > 0) {
        await logHistory(id, 'update', `Atualizou: ${changedFields.join(', ')}`, undefined, undefined, targetDb);
    }

    revalidatePath(`/org/${orgId}/kanban`);
}
