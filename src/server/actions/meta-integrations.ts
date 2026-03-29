"use server";

import { db } from "@/lib/db";
import { metaIntegrations } from "@/server/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_GRAPH_URL = "https://graph.facebook.com/v22.0";

// ============================================================
// HELPERS
// ============================================================

async function ensureIntegration(orgId: string) {
  let existing = await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
  if (!existing) {
    const [created] = await db.insert(metaIntegrations).values({
      organizationId: orgId,
      isActive: true,
    }).returning();
    existing = created;
  }
  return existing;
}

function metaFetch(url: string) {
  return fetch(url, {
    headers: META_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
      : {},
  });
}

// ============================================================
// READ
// ============================================================

export async function getMetaIntegration(orgId: string) {
  const { getAuthenticatedUser } = await import("@/lib/auth-helper");
  const session = await getAuthenticatedUser();
  if (!session?.id) throw new Error("Unauthorized");

  return await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
}

// ============================================================
// FIND ORG BY META ID (usado pelo webhook router)
// ============================================================

export async function findOrgByMetaId(identifier: {
  wabaId?: string;
  phoneNumberId?: string;
  igAccountId?: string;
  fromPhone?: string;
}): Promise<string | null> {
  if (identifier.phoneNumberId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.phoneNumberId, identifier.phoneNumberId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  if (identifier.wabaId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.wabaId, identifier.wabaId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  if (identifier.igAccountId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.igAccountId, identifier.igAccountId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  if (identifier.fromPhone) {
    const cleanPhone = identifier.fromPhone.replace(/\D/g, "");
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.whatsappNumber, cleanPhone),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  return null;
}

// ============================================================
// SAVE AD ACCOUNT (independente)
// ============================================================

export async function saveAdAccount(orgId: string, orgSlug: string, adAccountId: string) {
  const record = await ensureIntegration(orgId);
  const cleanId = adAccountId.replace(/^act_/, "").trim();
  const formattedId = cleanId ? `act_${cleanId}` : null;

  let accountName: string | null = record.accountName;

  // Tentar buscar nome da conta
  if (formattedId && META_ACCESS_TOKEN) {
    try {
      const res = await metaFetch(`${META_GRAPH_URL}/${formattedId}?fields=name`);
      if (res.ok) {
        const data = await res.json();
        accountName = data.name || null;
      }
    } catch { /* silently fail */ }
  }

  await db.update(metaIntegrations)
    .set({ adAccountId: formattedId, accountName, updatedAt: new Date() })
    .where(eq(metaIntegrations.id, record.id));

  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true, accountName };
}

// ============================================================
// SAVE WHATSAPP (independente)
// ============================================================

export async function saveWhatsApp(
  orgId: string,
  orgSlug: string,
  whatsappType: 'waba' | 'business_number',
  data: {
    wabaId?: string;
    phoneNumberId?: string;
    whatsappNumber?: string;
  }
) {
  const record = await ensureIntegration(orgId);
  let displayPhone: string | null = record.displayPhone;

  if (whatsappType === 'waba') {
    // Se deu WABA ID, tenta buscar phone numbers
    const wabaId = data.wabaId?.trim() || null;
    let phoneNumberId = data.phoneNumberId?.trim() || null;

    if (wabaId && !phoneNumberId && META_ACCESS_TOKEN) {
      try {
        const res = await metaFetch(
          `${META_GRAPH_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`
        );
        if (res.ok) {
          const phoneData = await res.json();
          if (phoneData.data?.length > 0) {
            phoneNumberId = phoneData.data[0].id;
            displayPhone = phoneData.data[0].display_phone_number || displayPhone;
          }
        }
      } catch { /* silently fail */ }
    }

    // Se deu phone number ID, tenta buscar o display
    if (phoneNumberId && !displayPhone && META_ACCESS_TOKEN) {
      try {
        const res = await metaFetch(
          `${META_GRAPH_URL}/${phoneNumberId}?fields=display_phone_number,verified_name`
        );
        if (res.ok) {
          const phoneInfo = await res.json();
          displayPhone = phoneInfo.display_phone_number || displayPhone;
        }
      } catch { /* silently fail */ }
    }

    await db.update(metaIntegrations)
      .set({
        whatsappType: 'waba',
        wabaId,
        phoneNumberId,
        whatsappNumber: null,
        displayPhone,
        updatedAt: new Date(),
      })
      .where(eq(metaIntegrations.id, record.id));
  } else {
    // business_number
    const cleanNumber = data.whatsappNumber?.replace(/\D/g, "") || null;

    await db.update(metaIntegrations)
      .set({
        whatsappType: 'business_number',
        wabaId: null,
        phoneNumberId: null,
        whatsappNumber: cleanNumber,
        displayPhone: cleanNumber,
        updatedAt: new Date(),
      })
      .where(eq(metaIntegrations.id, record.id));
  }

  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}

// ============================================================
// SAVE INSTAGRAM (independente)
// ============================================================

export async function saveInstagram(
  orgId: string,
  orgSlug: string,
  data: { igUsername?: string; igAccountId?: string }
) {
  const record = await ensureIntegration(orgId);
  const username = data.igUsername?.replace(/^@/, "").trim() || null;
  const accountId = data.igAccountId?.trim() || null;

  await db.update(metaIntegrations)
    .set({ igAccountId: accountId, igUsername: username, updatedAt: new Date() })
    .where(eq(metaIntegrations.id, record.id));

  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}

// ============================================================
// REMOVE (limpa tudo)
// ============================================================

export async function removeMetaIntegration(orgId: string, orgSlug: string) {
  await db.delete(metaIntegrations)
    .where(eq(metaIntegrations.organizationId, orgId));
  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}

// ============================================================
// LEGACY (manter compatibilidade com código existente)
// ============================================================

export async function saveMetaIntegration(
  orgId: string,
  orgSlug: string,
  adAccountId: string,
  whatsappType: 'waba' | 'business_number' = 'waba',
  whatsappNumber?: string
) {
  await saveAdAccount(orgId, orgSlug, adAccountId);
  if (whatsappType === 'business_number' && whatsappNumber) {
    await saveWhatsApp(orgId, orgSlug, 'business_number', { whatsappNumber });
  }
  const record = await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
  revalidatePath(`/org/${orgSlug}/settings`);
  return {
    success: true,
    discovered: {
      accountName: record?.accountName,
      adAccountId: record?.adAccountId,
      whatsappType: record?.whatsappType,
      wabaId: record?.wabaId,
      phoneNumberId: record?.phoneNumberId,
      whatsappNumber: record?.whatsappNumber,
      displayPhone: record?.displayPhone,
      igAccountId: record?.igAccountId,
    },
    errors: [],
  };
}

export async function updateMetaIds(
  orgId: string,
  orgSlug: string,
  updates: {
    wabaId?: string;
    phoneNumberId?: string;
    igAccountId?: string;
    whatsappNumber?: string;
  }
) {
  const existing = await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
  if (!existing) {
    return { success: false, error: "Nenhuma integração encontrada." };
  }

  const cleanUpdates = { ...updates };
  if (cleanUpdates.whatsappNumber) {
    cleanUpdates.whatsappNumber = cleanUpdates.whatsappNumber.replace(/\D/g, "");
  }

  await db.update(metaIntegrations)
    .set({ ...cleanUpdates, updatedAt: new Date() })
    .where(eq(metaIntegrations.id, existing.id));

  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}
