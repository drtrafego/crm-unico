'use server'

import { db } from "@/lib/db";
import { leads, columns, organizations, leadHistory, members } from "@/server/db/schema";
import { eq, asc, desc, and, ne, lt, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

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
    toColumn?: string
) {
    const session = await auth();
    const userId = session?.user?.id;

    await db.insert(leadHistory).values({
        leadId,
        action,
        details,
        fromColumn,
        toColumn,
        userId
    });
}

export async function getLeadHistory(leadId: string) {
    const history = await db.select().from(leadHistory)
        .where(eq(leadHistory.leadId, leadId))
        .orderBy(desc(leadHistory.createdAt));

    return history;
}

// --- Refactored Actions for Multi-tenant ---

export async function getColumns(orgId: string) {
    // First, fetch all existing columns
    const existing = await db.query.columns.findMany({
        where: eq(columns.organizationId, orgId),
        orderBy: [asc(columns.order)],
    });

    // Define the expected standard columns
    const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];

    // 1. Handle empty state - Only initialize if NO columns exist
    if (existing.length === 0) {
        const inserted = await db.insert(columns).values(
            expectedTitles.map((title, i) => ({
                title,
                organizationId: orgId,
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
    await db.delete(leads).where(and(eq(leads.id, id), eq(leads.organizationId, orgId)));
    revalidatePath(`/org/${orgId}/kanban`); // This path needs to be dynamic or handled by caller context
}

export async function getLeads(orgId: string) {
    return await db.query.leads.findMany({
        where: eq(leads.organizationId, orgId),
        orderBy: [asc(leads.position), desc(leads.createdAt)],
    });
}

export async function updateLeadStatus(id: string, newColumnId: string, newPosition: number, orgId: string) {
    await checkPermissions(orgId);
    console.log(`[Move] Lead: ${id} -> Col: ${newColumnId} (Pos: ${newPosition})`);

    try {
        // --- Logic for Response Time Metric ---
        const lead = await db.query.leads.findFirst({
            where: and(eq(leads.id, id), eq(leads.organizationId, orgId)),
        });

        if (lead) {
            // Check if moving FROM the first column (usually "New")
            // We need to identify the "New" column. Assuming it's the one with order 0 or specific title.
            // Better approach: Check if lead.status is changing from 'New' equivalent.
            // Simplified logic: If firstContactAt is null and we are moving to a different column, set it.
            if (!lead.firstContactAt && newColumnId !== lead.columnId) {
                await db.update(leads)
                    .set({ firstContactAt: new Date() })
                    .where(eq(leads.id, id));
            }

            // Log History if column changed
            if (newColumnId !== lead.columnId) {
                // Fetch new column title for better logging (optional but nice)
                const newCol = await db.query.columns.findFirst({
                    where: eq(columns.id, newColumnId)
                });

                await logHistory(
                    id,
                    'move',
                    `Movido para ${newCol?.title || 'nova coluna'}`,
                    lead.columnId || undefined,
                    newColumnId
                );
            }
        }
        // --------------------------------------

        await db.update(leads)
            .set({
                columnId: newColumnId,
                position: newPosition
            })
            .where(and(eq(leads.id, id), eq(leads.organizationId, orgId)));

        // revalidatePath('/dashboard/crm'); // TODO: Fix revalidation path
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
    console.log(`[createLead] Creating lead for Org: ${orgId}`);

    // Get the first column to add the lead to
    const firstColumn = await db.query.columns.findFirst({
        where: eq(columns.organizationId, orgId),
        orderBy: [asc(columns.order)],
    });

    if (!firstColumn) {
        throw new Error("No columns found");
    }

    const [newLead] = await db.insert(leads).values({
        name,
        company,
        email,
        whatsapp,
        notes,
        value,
        status: 'active',
        columnId: firstColumn.id,
        organizationId: orgId,
        position: 0, // Add to top
    }).returning();

    await logHistory(newLead.id, 'create', `Lead criado em ${firstColumn.title}`, undefined, firstColumn.id);

    // revalidatePath('/dashboard/crm');
}

export async function createColumn(title: string, orgId: string) {
    await checkPermissions(orgId);
    console.log(`[createColumn] Org: ${orgId} | Title: ${title}`);
    const existingColumns = await getColumns(orgId);

    await db.insert(columns).values({
        title,
        organizationId: orgId,
        order: existingColumns.length,
    });

    // revalidatePath('/dashboard/crm');
}

export async function updateColumn(id: string, title: string, orgId: string) {
    await checkPermissions(orgId);
    console.log(`[updateColumn] Org: ${orgId} | Col: ${id} -> Title: ${title}`);
    await db.update(columns)
        .set({ title })
        .where(and(eq(columns.id, id), eq(columns.organizationId, orgId)));
    // revalidatePath('/dashboard/crm');
}

export async function updateColumnOrder(orderedIds: string[], orgId: string) {
    await checkPermissions(orgId);
    console.log(`[updateColumnOrder] Org: ${orgId} | New Order:`, orderedIds);

    try {
        // Process updates sequentially
        for (let i = 0; i < orderedIds.length; i++) {
            const result = await db.update(columns)
                .set({ order: i })
                .where(and(eq(columns.id, orderedIds[i]), eq(columns.organizationId, orgId)))
                .returning({ id: columns.id });

            if (result.length === 0) {
                console.warn(`[updateColumnOrder] Warning: No column updated for ID ${orderedIds[i]} (Index ${i})`);
            }
        }

        // revalidatePath('/dashboard/crm');
        console.log(`[updateColumnOrder] Success`);

        // Fetch and return the verified new order
        const updatedColumns = await db.query.columns.findMany({
            where: eq(columns.organizationId, orgId),
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

    // Get the column being deleted to know its order
    const columnToDelete = await db.query.columns.findFirst({
        where: eq(columns.id, id)
    });

    if (!columnToDelete) return; // Already deleted

    // Find a fallback column:
    // 1. Try to find the immediate predecessor (order < deleted.order)
    let fallbackCol = await db.query.columns.findFirst({
        where: and(
            eq(columns.organizationId, orgId),
            ne(columns.id, id),
            lt(columns.order, columnToDelete.order) // Less than
        ),
        orderBy: [desc(columns.order)] // Highest order less than current (closest predecessor)
    });

    // 2. If no predecessor (was first column), find immediate successor
    if (!fallbackCol) {
        fallbackCol = await db.query.columns.findFirst({
            where: and(
                eq(columns.organizationId, orgId),
                ne(columns.id, id),
                gt(columns.order, columnToDelete.order) // Greater than
            ),
            orderBy: [asc(columns.order)] // Lowest order greater than current
        });
    }

    if (!fallbackCol) {
        throw new Error("Cannot delete the last column. At least one column must remain.");
    }

    // Move leads to the fallback column
    await db.update(leads)
        .set({ columnId: fallbackCol.id })
        .where(eq(leads.columnId, id));

    // Delete the column
    await db.delete(columns).where(and(eq(columns.id, id), eq(columns.organizationId, orgId)));

    // Reorder remaining columns to close the gap
    const remainingColumns = await db.query.columns.findMany({
        where: eq(columns.organizationId, orgId),
        orderBy: [asc(columns.order)]
    });

    for (let i = 0; i < remainingColumns.length; i++) {
        await db.update(columns)
            .set({ order: i })
            .where(eq(columns.id, remainingColumns[i].id));
    }

    // revalidatePath('/dashboard/crm');
}

export async function updateLeadContent(id: string, data: Partial<typeof leads.$inferInsert>, orgId: string) {
    await checkPermissions(orgId);
    // Whitelist allowed fields to prevent accidental overwrites of critical data
    // like columnId, position, organizationId, etc.
    // Removed 'status' from whitelist to prevent any accidental status changes during edit
    const allowedFields: (keyof typeof leads.$inferInsert)[] = [
        'name',
        'company',
        'email',
        'whatsapp',
        'notes',
        'value',
        'campaignSource',
        'followUpDate',
        'followUpNote'
    ];

    const updatePayload: Partial<typeof leads.$inferInsert> = {};

    // Only copy allowed fields
    for (const key of allowedFields) {
        if (data[key] !== undefined) {
            // @ts-ignore - dynamic assignment
            updatePayload[key] = data[key];
        }
    }

    // Handle empty strings or whitespace for value
    if (typeof updatePayload.value === 'string' && updatePayload.value.trim() === '') {
        updatePayload.value = null;
    } else if (updatePayload.value === "") {
        updatePayload.value = null;
    }

    // If nothing to update, return early
    // Note: We might still need to update columnId/position if passed, so check that later or check data keys

    console.log(`Updating lead content ${id} with payload:`, updatePayload);

    // Verify lead exists first (optional but good for debugging)
    const existingLead = await db.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.organizationId, orgId)),
        columns: { id: true, columnId: true, position: true }
    });

    if (!existingLead) {
        console.error(`Lead ${id} not found for update`);
        return;
    }

    // Handle columnId and position
    // If provided in data (from trusted client source context), use it.
    // Otherwise, preserve existing DB value.
    // This solves the race condition where client has moved the item (optimistic)
    // but DB hasn't updated yet when edit happens.
    if (data.columnId !== undefined) {
        console.log(`[updateLeadContent] Using provided columnId: ${data.columnId}`);
        updatePayload.columnId = data.columnId;
    } else {
        console.log(`[updateLeadContent] Using existing DB columnId: ${existingLead.columnId}`);
        updatePayload.columnId = existingLead.columnId;
    }

    if (data.position !== undefined) {
        updatePayload.position = data.position;
    } else {
        updatePayload.position = existingLead.position;
    }

    console.log(`Final update payload for lead ${id}:`, updatePayload);

    await db.update(leads)
        .set(updatePayload)
        .where(and(eq(leads.id, id), eq(leads.organizationId, orgId)));

    // Log content update
    const changedFields = Object.keys(updatePayload).filter(k => k !== 'columnId' && k !== 'position');
    if (changedFields.length > 0) {
        await logHistory(id, 'update', `Atualizou: ${changedFields.join(', ')}`);
    }

    // revalidatePath('/dashboard/crm');
}
