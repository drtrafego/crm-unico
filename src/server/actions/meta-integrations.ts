"use server";

import { db } from "@/lib/db";
import { metaIntegrations, organizations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ============================================================
// META INTEGRATIONS - Server Actions
// Gerencia o mapeamento de contas Meta → organizações
// ============================================================

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_GRAPH_URL = "https://graph.facebook.com/v22.0";

/**
 * Busca a integração Meta de uma organização
 */
export async function getMetaIntegration(orgId: string) {
  return await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });
}

/**
 * Busca a organização pelo WABA ID, phone_number_id ou IG account ID
 * Usado pelo webhook para rotear mensagens pro cliente certo
 */
export async function findOrgByMetaId(identifier: {
  wabaId?: string;
  phoneNumberId?: string;
  igAccountId?: string;
}): Promise<string | null> {
  // Tenta pelo phone_number_id primeiro (mais específico)
  if (identifier.phoneNumberId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.phoneNumberId, identifier.phoneNumberId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  // Tenta pelo WABA ID
  if (identifier.wabaId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.wabaId, identifier.wabaId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  // Tenta pelo IG Account ID
  if (identifier.igAccountId) {
    const match = await db.query.metaIntegrations.findFirst({
      where: and(
        eq(metaIntegrations.igAccountId, identifier.igAccountId),
        eq(metaIntegrations.isActive, true)
      ),
    });
    if (match) return match.organizationId;
  }

  return null;
}

/**
 * Salva/atualiza integração Meta para uma organização
 * Faz auto-discovery dos IDs do WhatsApp e Instagram via Meta Graph API
 */
export async function saveMetaIntegration(
  orgId: string,
  orgSlug: string,
  adAccountId: string
) {
  // Normalizar o ad account ID (aceita com ou sem "act_")
  const cleanAdAccountId = adAccountId.replace(/^act_/, "").trim();
  const formattedAdAccountId = `act_${cleanAdAccountId}`;

  // Buscar dados via Meta Graph API
  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;
  let igAccountId: string | null = null;
  let displayPhone: string | null = null;
  let accountName: string | null = null;
  let discoveryErrors: string[] = [];

  if (META_ACCESS_TOKEN) {
    // 1. Buscar detalhes da conta de anúncio
    try {
      const adAccountRes = await fetch(
        `${META_GRAPH_URL}/${formattedAdAccountId}?fields=name,business{id,name}&access_token=${META_ACCESS_TOKEN}`
      );
      if (adAccountRes.ok) {
        const adAccountData = await adAccountRes.json();
        accountName = adAccountData.name || null;
        const businessId = adAccountData.business?.id;

        if (businessId) {
          // 2. Buscar WABAs do Business Manager
          try {
            const wabaRes = await fetch(
              `${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts?fields=id,name,on_behalf_of_business_info&access_token=${META_ACCESS_TOKEN}`
            );
            if (wabaRes.ok) {
              const wabaData = await wabaRes.json();
              if (wabaData.data?.length > 0) {
                wabaId = wabaData.data[0].id;

                // 3. Buscar phone numbers do WABA
                try {
                  const phoneRes = await fetch(
                    `${META_GRAPH_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${META_ACCESS_TOKEN}`
                  );
                  if (phoneRes.ok) {
                    const phoneData = await phoneRes.json();
                    if (phoneData.data?.length > 0) {
                      phoneNumberId = phoneData.data[0].id;
                      displayPhone = phoneData.data[0].display_phone_number || null;
                    }
                  }
                } catch (e) {
                  discoveryErrors.push("Não foi possível buscar os números de telefone do WhatsApp");
                }
              }
            }
          } catch (e) {
            discoveryErrors.push("Não foi possível buscar as contas WhatsApp Business");
          }

          // 4. Buscar Instagram accounts do Business Manager
          try {
            const igRes = await fetch(
              `${META_GRAPH_URL}/${businessId}/owned_instagram_accounts?fields=id,username,name&access_token=${META_ACCESS_TOKEN}`
            );
            if (igRes.ok) {
              const igData = await igRes.json();
              if (igData.data?.length > 0) {
                igAccountId = igData.data[0].id;
              }
            } else {
              // Fallback: tentar por instagram_accounts
              const igRes2 = await fetch(
                `${META_GRAPH_URL}/${businessId}/instagram_accounts?fields=id,username&access_token=${META_ACCESS_TOKEN}`
              );
              if (igRes2.ok) {
                const igData2 = await igRes2.json();
                if (igData2.data?.length > 0) {
                  igAccountId = igData2.data[0].id;
                }
              }
            }
          } catch (e) {
            discoveryErrors.push("Não foi possível buscar as contas do Instagram");
          }
        } else {
          discoveryErrors.push("Conta de anúncio não está vinculada a um Business Manager");
        }
      } else {
        const errorData = await adAccountRes.json().catch(() => ({}));
        discoveryErrors.push(`Erro ao acessar conta de anúncio: ${errorData?.error?.message || adAccountRes.status}`);
      }
    } catch (e) {
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
    wabaId,
    phoneNumberId,
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
      wabaId,
      phoneNumberId,
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
 * Atualiza manualmente IDs específicos (caso auto-discovery não funcione)
 */
export async function updateMetaIds(
  orgId: string,
  orgSlug: string,
  updates: {
    wabaId?: string;
    phoneNumberId?: string;
    igAccountId?: string;
  }
) {
  const existing = await db.query.metaIntegrations.findFirst({
    where: eq(metaIntegrations.organizationId, orgId),
  });

  if (!existing) {
    return { success: false, error: "Integração não encontrada. Configure a conta de anúncio primeiro." };
  }

  await db.update(metaIntegrations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(metaIntegrations.id, existing.id));

  revalidatePath(`/org/${orgSlug}/settings`);
  return { success: true };
}
