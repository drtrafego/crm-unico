'use server'

import { db } from "@/lib/db";
import { organizations, columns, members } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createOrganization(name: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Generate slug
    const slug = name.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Remove duplicate hyphens

    // Check if slug exists
    const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug)
    });

    if (existing) {
        throw new Error("Organization with this slug already exists");
    }

    // Create Org
    const [newOrg] = await db.insert(organizations).values({
        name,
        slug,
    }).returning();

    // Add Creator as Owner
    await db.insert(members).values({
        userId: session.user.id,
        organizationId: newOrg.id,
        role: 'owner'
    });

    // Create Default Columns
    const expectedTitles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];

    await db.insert(columns).values(
        expectedTitles.map((title, i) => ({
            title,
            organizationId: newOrg.id,
            order: i
        }))
    );

    revalidatePath('/adm/dashboard');
    return newOrg;
}

export async function getOrganizationBySlug(slug: string) {
    if (!slug) return null;
    return await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug)
    });
}
