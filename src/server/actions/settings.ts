'use server'

import { db } from "@/lib/db";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

export async function getSettings(orgId: string) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "Minha Empresa";

  const existing = await db.query.settings.findFirst({
    where: eq(settings.organizationId, orgId),
  });

  // Lazy initialization: if settings don't exist, create them with the email
  if (!existing) {
    const [newSettings] = await db.insert(settings).values({
      organizationId: orgId,
      companyName: name,
      email: email,
      viewMode: 'kanban',
    }).returning();
    return newSettings;
  }

  // Update email if it's missing in DB but we have it now
  if (!existing.email && email) {
    await db.update(settings).set({ email }).where(eq(settings.id, existing.id));
  }

  return existing;
}

export async function updateCompanyName(name: string, orgId: string) {
  const existing = await getSettings(orgId); // This will now ensure creation

  if (existing) {
    await db.update(settings)
      .set({ companyName: name })
      .where(eq(settings.id, existing.id));
  }

  revalidatePath(`/org/${orgId}/settings`);
}

export async function updateViewMode(viewMode: string, orgId: string) {
  const existing = await getSettings(orgId); // Ensure existence

  if (existing) {
    await db.update(settings)
      .set({ viewMode })
      .where(eq(settings.id, existing.id));
  }
  revalidatePath(`/org/${orgId}/settings`);
}

