'use server'

import { db, adminDb } from "@/lib/db";
import { leads, columns, leadHistory, members, organizations } from "@/server/db/schema";
import { eq, asc, desc, and, ne, lt, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// Primary ID for Layout/Structure (The one with the correct columns)
const PRIMARY_SUPER_ADMIN_ID = "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5";

// All IDs to fetch data from
const SUPER_ADMIN_DB_ORG_IDS = [
    "5026ab39-9cd0-4dde-ba5a-dcf4f51612d5",
    "super-admin-personal",
    "bilder_agency_shared"
];

// Helper to determine which DB and OrgIDs to use
async function getContext(orgId: string) {
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { slug: true }
    });

    const isSuperAdmin = org?.slug === "admin";

    return {
        targetDb: isSuperAdmin ? adminDb : db,
        // For reads, we look at everything. For writes, we default to Primary/Master.
        targetOrgIds: isSuperAdmin ? SUPER_ADMIN_DB_ORG_IDS : [orgId],
        primaryOrgId: isSuperAdmin ? PRIMARY_SUPER_ADMIN_ID : orgId,
        isSuperAdmin
    };
}

async function checkPermissions(orgId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // FIX: If the action is requested for a Legacy ID (e.g. bilder_agency_shared),
    // we must check permissions against the ACTUAL authenticated Organization (Casal do Tráfego).
    // The user is a member of 'Casal do Tráfego' (Client DB), not 'bilder_agency_shared' (Admin DB string).

    let orgIdToCheck = orgId;
    if (SUPER_ADMIN_DB_ORG_IDS.includes(orgId)) {
        // Resolve to the ID of "Casal do Tráfego" in the Client DB
        // We can fetch this dynamicall or, since we know we are in Super Admin context,
        // we look for the org with slug 'admin' which is the auth anchor.
        const adminOrg = await db.query.organizations.findFirst({
            where: eq(organizations.slug, "admin"),
            columns: { id: true }
        });
        if (adminOrg) {
            orgIdToCheck = adminOrg.id;
        }
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.organizationId, orgIdToCheck),
            eq(members.userId, session.user.id)
        )
    });

    if (!member) {
        // Fallback: Try checking exact match if mapping failed
        const exactMember = await db.query.members.findFirst({
            where: and(
                eq(members.organizationId, orgId),
                eq(members.userId, session.user.id)
            )
        });
        if (!exactMember) throw new Error(`Not a member (Checked: ${orgIdToCheck} & ${orgId})`);
        // If exact match worked, use it
        if (exactMember.role === 'viewer') throw new Error("Permission denied");
        return exactMember;
    }

    if (member.role === 'viewer') {
        throw new Error("Permission denied: Viewers cannot modify data");
    }

    return member;
}

async function logHistory(leadId: string, action: 'create' | 'move' | 'update', details: string, fromColumn?: string, toColumn?: string, contextDb: typeof db = db) {
    const session = await auth();
    await contextDb.insert(leadHistory).values({
        leadId, action, details, fromColumn, toColumn, userId: session?.user?.id
    });
}

export async function getLeadHistory(leadId: string) {
    let history = await db.select().from(leadHistory).where(eq(leadHistory.leadId, leadId)).orderBy(desc(leadHistory.createdAt));
    if (history.length === 0) {
        const adminHistory = await adminDb.select().from(leadHistory).where(eq(leadHistory.leadId, leadId)).orderBy(desc(leadHistory.createdAt));
        if (adminHistory.length > 0) return adminHistory;
    }
    return history;
}

export async function getColumns(orgId: string) {
    const { targetDb, primaryOrgId } = await getContext(orgId);

    // Only fetch columns for the PRIMARY ID to ensure a stable, unified layout
    const existing = await targetDb.query.columns.findMany({
        where: eq(columns.organizationId, primaryOrgId),
        orderBy: [asc(columns.order)],
    });

    if (existing.length === 0) {
        // Fallback: If primary has no columns yet, create defaults
        const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];
        const inserted = await targetDb.insert(columns).values(
            expectedTitles.map((title, i) => ({ title, organizationId: primaryOrgId, order: i }))
        ).returning();
        return inserted.sort((a, b) => a.order - b.order);
    }

    return existing.sort((a, b) => a.order - b.order);
}

export async function getLeads(orgId: string) {
    const { targetDb, targetOrgIds, primaryOrgId, isSuperAdmin } = await getContext(orgId);

    // 1. Fetch ALL leads from ALL target IDs
    const allLeads = await targetDb.query.leads.findMany({
        where: inArray(leads.organizationId, targetOrgIds),
        orderBy: [asc(leads.position), desc(leads.createdAt)],
    });

    // If not super admin (or simple single-tenant), return as is
    if (!isSuperAdmin || targetOrgIds.length === 1) {
        return allLeads;
    }

    // 2. VIRTUAL MAPPING for Super Admin
    // We need to map leads from "Legacy IDs" to the "Primary ID" columns based on title matching.

    // Fetch all columns involved (Legacy + Primary)
    const allColumns = await targetDb.query.columns.findMany({
        where: inArray(columns.organizationId, targetOrgIds)
    });

    // Indentify Primary Columns (The ones visible on board)
    const primaryColumns = allColumns.filter(c => c.organizationId === primaryOrgId);

    // Create a map: Title -> PrimaryColumnId
    const titleToPrimaryId = new Map<string, string>();
    primaryColumns.forEach(c => titleToPrimaryId.set(c.title.trim().toLowerCase(), c.id));

    // Create a fallback column (first primary column)
    const fallbackColumnId = primaryColumns.sort((a, b) => a.order - b.order)[0]?.id;

    // Create a map: LegacyColumnId -> PrimaryColumnId
    const legacyToPrimaryId = new Map<string, string>();

    allColumns.forEach(c => {
        if (c.organizationId === primaryOrgId) return; // Skip primary cols

        // Find matching primary column by title
        const matchId = titleToPrimaryId.get(c.title.trim().toLowerCase());
        if (matchId) {
            legacyToPrimaryId.set(c.id, matchId);
        } else {
            // SAFE FALLBACK: Map to first column if no title match
            if (fallbackColumnId) legacyToPrimaryId.set(c.id, fallbackColumnId);
        }
    });

    // Transform leads: Swap legacy column ID with mapped primary ID
    return allLeads.map(lead => {
        // If lead is already in a primary column, keep it.
        if (lead.columnId && primaryColumns.some(pc => pc.id === lead.columnId)) {
            return lead;
        }

        // If lead is in a legacy column, map it
        if (lead.columnId) {
            const mappedId = legacyToPrimaryId.get(lead.columnId);
            if (mappedId) {
                return { ...lead, columnId: mappedId };
            }
        }

        // Final fallback
        return { ...lead, columnId: fallbackColumnId || lead.columnId };
    });
}

export async function deleteLead(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);
    await targetDb.delete(leads).where(and(eq(leads.id, id), inArray(leads.organizationId, targetOrgIds)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateLeadStatus(id: string, newColumnId: string, newPosition: number, orgId: string) {
    await checkPermissions(orgId);
    // Writes should propagate to the ACTUAL record location, but update the column to the new PRIMARY one.
    // This effectively migrates the lead to the new column structure incrementally.
    const { targetDb, targetOrgIds, primaryOrgId } = await getContext(orgId);

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
        organizationId: primaryOrgId, // New leads go to PRIMARY
        position: 0,
    }).returning();

    await logHistory(newLead.id, 'create', `Lead criado em ${firstColumn.title}`, undefined, firstColumn.id, targetDb);
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
        organizationId: primaryOrgId, // New columns go to PRIMARY
        order: existing.length,
    });
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumn(id: string, title: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    // Allow updating title of any visible column
    await targetDb.update(columns)
        .set({ title })
        .where(and(eq(columns.id, id), inArray(columns.organizationId, targetOrgIds)));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateColumnOrder(orderedIds: string[], orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    for (let i = 0; i < orderedIds.length; i++) {
        await targetDb.update(columns)
            .set({ order: i })
            .where(and(eq(columns.id, orderedIds[i]), inArray(columns.organizationId, targetOrgIds)));
    }
    revalidatePath(`/org/${orgId}/kanban`);
    return { success: true };
}

export async function deleteColumn(id: string, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    const col = await targetDb.query.columns.findFirst({ where: eq(columns.id, id) });
    if (!col) return;

    await targetDb.delete(columns).where(eq(columns.id, id));
    revalidatePath(`/org/${orgId}/kanban`);
}

export async function updateLeadContent(id: string, data: Partial<typeof leads.$inferInsert>, orgId: string) {
    await checkPermissions(orgId);
    const { targetDb, targetOrgIds } = await getContext(orgId);

    const allowedFields: (keyof typeof leads.$inferInsert)[] = [
        'name', 'company', 'email', 'whatsapp', 'notes', 'value',
        'campaignSource', 'followUpDate', 'followUpNote'
    ];
    const payload: any = {};
    allowedFields.forEach(k => { if (data[k] !== undefined) payload[k] = data[k]; });

    if (payload.value === '') payload.value = null;

    if (data.columnId) payload.columnId = data.columnId;
    if (data.position !== undefined) payload.position = data.position;

    await targetDb.update(leads)
        .set(payload)
        .where(eq(leads.id, id)); // ID is unique enough

    revalidatePath(`/org/${orgId}/kanban`);
}
