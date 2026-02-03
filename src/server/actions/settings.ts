'use server'

import { db } from "@/lib/db";
import { settings, members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

// Helper to check if user is admin or owner
async function checkSettingsPermission(orgId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, orgId),
      eq(members.userId, session.user.id)
    )
  });

  if (!member) throw new Error("Not a member");

  // Only admin and owner can modify settings
  if (member.role !== 'admin' && member.role !== 'owner') {
    throw new Error("Permission denied: Only admin or owner can modify settings");
  }

  return member;
}

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
  await checkSettingsPermission(orgId); // Only admin/owner can modify
  const existing = await getSettings(orgId); // This will now ensure creation

  if (existing) {
    await db.update(settings)
      .set({ companyName: name })
      .where(eq(settings.id, existing.id));
  }

  revalidatePath(`/org/${orgId}/settings`);
}

export async function updateViewMode(viewMode: string, orgId: string) {
  await checkSettingsPermission(orgId); // Only admin/owner can modify
  const existing = await getSettings(orgId); // Ensure existence

  if (existing) {
    await db.update(settings)
      .set({ viewMode })
      .where(eq(settings.id, existing.id));
  }
  revalidatePath(`/org/${orgId}/settings`);
}

