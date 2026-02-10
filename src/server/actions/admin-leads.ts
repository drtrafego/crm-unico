'use server'

import { adminDb } from "@/lib/db";
import { leads, columns, leadHistory, settings } from "@/server/db/schema";
import { eq, asc, desc, and, ne, lt, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const SUPER_ADMIN_ORG_ID = "super-admin-personal";

async function checkAdminPermissions() {
    const session = await auth();
    const userEmail = session?.user?.email;
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];

    if (!userEmail || !adminEmails.includes(userEmail)) {
        throw new Error("Unauthorized: Super Admin access required");
    }
    return session;
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
    const userId = session?.user?.id; // Note: This userId refers to the main auth DB, which is fine for logging text

    await adminDb.insert(leadHistory).values({
        leadId,
        action,
        details,
        fromColumn,
        toColumn,
        userId
    });
}

export async function getAdminLeadHistory(leadId: string) {
    const history = await adminDb.select().from(leadHistory)
        .where(eq(leadHistory.leadId, leadId))
        .orderBy(desc(leadHistory.createdAt));

    return history;
}

export async function getAdminColumns() {
    // First, fetch all existing columns
    const existing = await adminDb.query.columns.findMany({
        where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
        orderBy: [asc(columns.order)],
    });

    // Define the expected standard columns
    const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];

    // 1. Handle empty state - Only initialize if NO columns exist
    if (existing.length === 0) {
        const inserted = await adminDb.insert(columns).values(
            expectedTitles.map((title, i) => ({
                title,
                organizationId: SUPER_ADMIN_ORG_ID,
                order: i
            }))
        ).returning();
        return inserted.sort((a, b) => a.order - b.order);
    }

    // Return existing columns as-is, just sorted
    return existing.sort((a, b) => a.order - b.order);
}

export async function deleteAdminLead(id: string) {
    await checkAdminPermissions();
    await adminDb.delete(leads).where(and(eq(leads.id, id), eq(leads.organizationId, SUPER_ADMIN_ORG_ID)));
    revalidatePath(`/adm/leads`);
}

export async function getAdminLeads() {
    await checkAdminPermissions();
    return await adminDb.query.leads.findMany({
        where: eq(leads.organizationId, SUPER_ADMIN_ORG_ID),
        orderBy: [asc(leads.position), desc(leads.createdAt)],
    });
}

export async function updateAdminLeadStatus(id: string, newColumnId: string, newPosition: number) {
    await checkAdminPermissions();

    try {
        const lead = await adminDb.query.leads.findFirst({
            where: and(eq(leads.id, id), eq(leads.organizationId, SUPER_ADMIN_ORG_ID)),
        });

        if (lead) {
            if (!lead.firstContactAt && newColumnId !== lead.columnId) {
                await adminDb.update(leads)
                    .set({ firstContactAt: new Date() })
                    .where(eq(leads.id, id));
            }

            if (newColumnId !== lead.columnId) {
                const newCol = await adminDb.query.columns.findFirst({
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

        await adminDb.update(leads)
            .set({
                columnId: newColumnId,
                position: newPosition
            })
            .where(and(eq(leads.id, id), eq(leads.organizationId, SUPER_ADMIN_ORG_ID)));

        revalidatePath('/adm/leads');
    } catch (error) {
        console.error("[updateAdminLeadStatus] Error:", error);
        throw error;
    }
}

export async function createAdminLead(formData: FormData) {
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    const whatsapp = formData.get("whatsapp") as string;
    const notes = formData.get("notes") as string;
    const valueStr = formData.get("value") as string;
    const value = valueStr ? valueStr : null;

    const campaignSource = formData.get("campaignSource") as string;

    await checkAdminPermissions();

    const firstColumn = await adminDb.query.columns.findFirst({
        where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
        orderBy: [asc(columns.order)],
    });

    if (!firstColumn) {
        throw new Error("No columns found");
    }

    const [newLead] = await adminDb.insert(leads).values({
        name,
        company,
        email,
        whatsapp,
        notes,
        value,
        campaignSource,
        status: 'active',
        columnId: firstColumn.id,
        organizationId: SUPER_ADMIN_ORG_ID,
        position: 0,
    }).returning();

    await logHistory(newLead.id, 'create', `Lead criado em ${firstColumn.title}`, undefined, firstColumn.id);
    revalidatePath('/adm/leads');
}

export async function createAdminColumn(title: string) {
    await checkAdminPermissions();
    const existingColumns = await getAdminColumns();

    await adminDb.insert(columns).values({
        title,
        organizationId: SUPER_ADMIN_ORG_ID,
        order: existingColumns.length,
    });
    revalidatePath('/adm/leads');
}

export async function updateAdminColumn(id: string, title: string) {
    await checkAdminPermissions();
    await adminDb.update(columns)
        .set({ title })
        .where(and(eq(columns.id, id), eq(columns.organizationId, SUPER_ADMIN_ORG_ID)));
    revalidatePath('/adm/leads');
}

export async function updateAdminColumnOrder(orderedIds: string[]) {
    await checkAdminPermissions();
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await adminDb.update(columns)
                .set({ order: i })
                .where(and(eq(columns.id, orderedIds[i]), eq(columns.organizationId, SUPER_ADMIN_ORG_ID)));
        }

        const updatedColumns = await adminDb.query.columns.findMany({
            where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
            orderBy: [asc(columns.order)],
        });

        revalidatePath('/adm/leads');
        return { success: true, columns: updatedColumns };
    } catch (error) {
        console.error("[updateAdminColumnOrder] Error:", error);
        throw error;
    }
}

export async function deleteAdminColumn(id: string) {
    await checkAdminPermissions();

    const columnToDelete = await adminDb.query.columns.findFirst({
        where: eq(columns.id, id)
    });

    if (!columnToDelete) return;

    let fallbackCol = await adminDb.query.columns.findFirst({
        where: and(
            eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
            ne(columns.id, id),
            lt(columns.order, columnToDelete.order)
        ),
        orderBy: [desc(columns.order)]
    });

    if (!fallbackCol) {
        fallbackCol = await adminDb.query.columns.findFirst({
            where: and(
                eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
                ne(columns.id, id),
                gt(columns.order, columnToDelete.order)
            ),
            orderBy: [asc(columns.order)]
        });
    }

    if (!fallbackCol) {
        throw new Error("Cannot delete the last column.");
    }

    await adminDb.update(leads)
        .set({ columnId: fallbackCol.id })
        .where(eq(leads.columnId, id));

    await adminDb.delete(columns).where(and(eq(columns.id, id), eq(columns.organizationId, SUPER_ADMIN_ORG_ID)));

    const remainingColumns = await adminDb.query.columns.findMany({
        where: eq(columns.organizationId, SUPER_ADMIN_ORG_ID),
        orderBy: [asc(columns.order)]
    });

    for (let i = 0; i < remainingColumns.length; i++) {
        await adminDb.update(columns)
            .set({ order: i })
            .where(eq(columns.id, remainingColumns[i].id));
    }

    revalidatePath('/adm/leads');
}

export async function updateAdminLeadContent(id: string, data: Partial<typeof leads.$inferInsert>) {
    await checkAdminPermissions();

    const allowedFields: (keyof typeof leads.$inferInsert)[] = [
        'name', 'company', 'email', 'whatsapp', 'notes', 'value',
        'campaignSource', 'followUpDate', 'followUpNote'
    ];

    const updatePayload: Partial<typeof leads.$inferInsert> = {};
    for (const key of allowedFields) {
        if (data[key] !== undefined) {
            // @ts-ignore
            updatePayload[key] = data[key];
        }
    }

    if (typeof updatePayload.value === 'string' && updatePayload.value.trim() === '') {
        updatePayload.value = null;
    } else if (updatePayload.value === "") {
        updatePayload.value = null;
    }

    const existingLead = await adminDb.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.organizationId, SUPER_ADMIN_ORG_ID))
    });

    if (!existingLead) return;

    // Determine values specifically for diffing, respecting partial updates
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

    // --- Log History Logic --- 
    const changes: string[] = [];

    if (updatePayload.name !== undefined && updatePayload.name !== existingLead.name) {
        changes.push(`Nome alterado de "${existingLead.name}" para "${updatePayload.name}"`);
    }
    if (updatePayload.company !== undefined && updatePayload.company !== existingLead.company) {
        changes.push(`Empresa alterada para "${updatePayload.company}"`);
    }
    if (updatePayload.email !== undefined && updatePayload.email !== existingLead.email) {
        changes.push(`Email alterado`);
    }
    if (updatePayload.whatsapp !== undefined && updatePayload.whatsapp !== existingLead.whatsapp) {
        changes.push(`WhatsApp alterado`);
    }

    if (updatePayload.followUpNote !== undefined && updatePayload.followUpNote !== existingLead.followUpNote) {
        changes.push(`Motivo de retorno atualizado`);
    }

    if (updatePayload.value !== undefined) {
        const oldVal = existingLead.value ? Number(existingLead.value) : 0;
        const newVal = updatePayload.value ? Number(updatePayload.value) : 0;
        if (oldVal !== newVal) {
            changes.push(`Valor alterado de ${oldVal} para ${newVal}`);
        }
    }

    if (updatePayload.notes !== undefined && updatePayload.notes !== existingLead.notes) {
        changes.push(`Observações atualizadas`);
    }

    if (updatePayload.campaignSource !== undefined && updatePayload.campaignSource !== existingLead.campaignSource) {
        changes.push(`Origem alterada de ${existingLead.campaignSource || 'N/A'} para ${updatePayload.campaignSource}`);
    }

    if (updatePayload.followUpDate !== undefined) {
        const oldDate = existingLead.followUpDate ? new Date(existingLead.followUpDate).toISOString().split('T')[0] : 'N/A';
        const newDate = updatePayload.followUpDate ? new Date(updatePayload.followUpDate).toISOString().split('T')[0] : 'N/A';
        if (oldDate !== newDate) changes.push(`Data de retorno: ${oldDate} -> ${newDate}`);
    }

    if (changes.length > 0) {
        await logHistory(id, 'update', changes.join('; '));
    }
    // -------------------------

    await adminDb.update(leads)
        .set(updatePayload)
        .where(and(eq(leads.id, id), eq(leads.organizationId, SUPER_ADMIN_ORG_ID)));

    revalidatePath('/adm/leads');
}

export async function getAdminSettings() {
    const s = await adminDb.query.settings.findFirst({
        where: eq(settings.organizationId, SUPER_ADMIN_ORG_ID)
    });

    if (!s) {
        // Create default settings if not exist
        const [inserted] = await adminDb.insert(settings).values({
            organizationId: SUPER_ADMIN_ORG_ID,
            viewMode: 'kanban'
        }).returning();
        return inserted;
    }
    return s;
}
