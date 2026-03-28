"use server";

import { db } from "@/lib/db";
import { metaIntegrations } from "@/server/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ============================================================
// META INTEGRATIONS - Server Actions
// Suporta 2 tipos de conexão WhatsApp:
//   1. WABA (Cloud API) - webhook da Meta direto
//   2. Business Number - número direto, integra via webhook genérico
// ============================================================

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_GRAPH_URL = "https://graph.facebook.com/v22.0";

/**
 * Busca a integração Meta de uma organização
 */
export async function getMetaIntegration(orgId: string) {
  // Auth check inline (não importa auth-helper pois é 'use server' já com server-only no db)
  const { getAuthenticatedUser } = await import("@/lib/auth-helper");
  const session = await getAuthenticatedUser();
  if (!session?.id) throw new Error("Unauthorized");

  return await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
}

/**
 * Busca a organização pelo identificador Meta (usado pelo webhook router)
 * Suporta: phone_number_id, waba_id, ig_account_id, E whatsapp_number direto
 */
export async function findOrgByMetaId(identifier: {
  wabaId?: string;
  phoneNumberId?: string;
  igAccountId?: string;
  fromPhone?: string; // Número que enviou a mensagem (ex: "5511999999999")
}): Promise<string | null> {
  // 1. Tenta pelo phone_number_id (WABA - mais específico)
  if (identifier.phoneNumberId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.phoneNumberId, identifier.phoneNumberId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  // 2. Tenta pelo WABA ID
  if (identifier.wabaId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.wabaId, identifier.wabaId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  // 3. Tenta pelo IG Account ID
  if (identifier.igAccountId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.igAccountId, identifier.igAccountId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  // 4. Tenta pelo whatsapp_number (Business Number direto)
  // Normaliza o número removendo +, espaços, etc.
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

/**
 * Salva/atualiza integração Meta para uma organização
 * whatsappType: "waba" = Cloud API, "business_number" = número direto
 */
export async function saveMetaIntegration(
  orgId: string,
  orgSlug: string,
  adAccountId: string,
  whatsappType: 'waba' | 'business_number' = 'waba',
  whatsappNumber?: string
) {
  const cleanAdAccountId = adAccountId.replace(/^act_/, "").trim();
  const formattedAdAccountId = `act_${cleanAdAccountId}`;

  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;
  let igAccountId: string | null = null;
  let displayPhone: string | null = null;
  let accountName: string | null = null;
  let cleanWhatsappNumber: string | null = null;
  let discoveryErrors: string[] = [];

  // Limpar número do WhatsApp Business (se tipo = business_number)
  if (whatsappType === 'business_number' && whatsappNumber) {
    cleanWhatsappNumber = whatsappNumber.replace(/\D/g, "");
    displayPhone = cleanWhatsappNumber;
  }

  if (META_ACCESS_TOKEN) {
    // 1. Buscar detalhes da conta de anúncio
    try {
      const adAccountRes = await fetch(
        `${META_GRAPH_URL}/${formattedAdAccountId}?fields=name,business{id,name}`, { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } }
      );
      if (adAccountRes.ok) {
        const adAccountData = await adAccountRes.json();
        accountName = adAccountData.name || null;
        const businessId = adAccountData.business?.id;

        if (businessId) {
          // 2. Se tipo = WABA, buscar WABA e phone numbers
          if (whatsappType === 'waba') {
            try {
              const wabaRes = await fetch(
                `${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts?fields=id,name`, { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } }
              );
              if (wabaRes.ok) {
                const wabaData = await wabaRes.json();
                if (wabaData.data?.length > 0) {
                  wabaId = wabaData.data[0].id;
                  try {
                    const phoneRes = await fetch(
                      `${META_GRAPH_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } }
                    );
                    if (phoneRes.ok) {
                      const phoneData = await phoneRes.json();
                      if (phoneData.data?.length > 0) {
                        phoneNumberId = phoneData.data[0].id;
                        displayPhone = phoneData.data[0].display_phone_number || displayPhone;
                      }
                    }
                  } catch {
                    discoveryErrors.push("Não foi possível buscar os números de telefone do WABA");
                  }
                } else {
                  discoveryErrors.push("Nenhuma conta WABA encontrada neste Business Manager");
                }
              }
            } catch {
              discoveryErrors.push("Não foi possível buscar as contas WhatsApp Business");
            }
          }

          // 3. Buscar Instagram accounts (para ambos os tipos)
          try {
            const igRes = await fetch(
              `${META_GRAPH_URL}/${businessId}/owned_instagram_accounts?fields=id,username,name`, { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } }
            );
            if (igRes.ok) {
              const igData = await igRes.json();
              if (igData.data?.length > 0) {
                igAccountId = igData.data[0].id;
              }
            } else {
              const igRes2 = await fetch(
                `${META_GRAPH_URL}/${businessId}/instagram_accounts?fields=id,username`, { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } }
              );
              if (igRes2.ok) {
                const igData2 = await igRes2.json();
                if (igData2.data?.length > 0) {
                  igAccountId = igData2.data[0].id;
                }
              }
            }
          } catch {
            discoveryErrors.push("Não foi possível buscar as contas do Instagram");
          }
        } else {
          discoveryErrors.push("Conta de anúncio não está vinculada a um Business Manager");
        }
      } else {
        const errorData = await adAccountRes.json().catch(() => ({}));
        discoveryErrors.push(`Erro ao acessar conta: ${errorData?.error?.message || adAccountRes.status}`);
      }
    } catch {
      discoveryErrors.push("Erro de conexão com a Meta Graph API");
    }
  } else {
    discoveryErrors.push("META_ACCESS_TOKEN não configurado no servidor");
  }

  // Salvar no banco (upsert)
  const existing = await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });

  const data = {
    organizationId: orgId,
    adAccountId: formattedAdAccountId,
    whatsappType,
    wabaId: whatsappType === 'waba' ? wabaId : null,
    phoneNumberId: whatsappType === 'waba' ? phoneNumberId : null,
    whatsappNumber: whatsappType === 'business_number' ? cleanWhatsappNumber : null,
    igAccountId,
    displayPhone,
    accountName,
    isActive: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(metaIntegrations)
      .set(data)
      .where(eq(metaIntegrations.id, existing.id));
  } else {
    await db.insert(metaIntegrations).values(data);
  }

  revalidatePath(`/org/${orgSlug}/settings`);

  return {
    success: true,
    discovered: {
      accountName,
      adAccountId: formattedAdAccountId,
      whatsappType,
      wabaId,
      phoneNumberId,
      whatsappNumber: cleanWhatsappNumber,
      displayPhone,
      igAccountId,
    },
    errors: discoveryErrors,
  };
}

/**
 * Remove integração Meta de uma organização
 */
export async function removeMetaIntegration(orgId: string, orgSlug: string) {
  await db.delete(metaIntegrations)
    .where(eq(metaIntegrations.organizationId, orgId));
  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}

/**
 * Atualiza manualmente IDs específicos
 */
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
    return { success: false, error: "Configure a conta de anúncio primeiro." };
  }

  // Limpar número se fornecido
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
