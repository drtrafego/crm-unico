
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { users, invitations, members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getAuthenticatedUser() {
    const stackUser = await stackServerApp.getUser();
    if (!stackUser) return null;

    const email = stackUser.primaryEmail;
    if (!email) return null;

    // Sync: Find existing user in Neon DB
    let dbUser = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!dbUser) {
        // Auto-Sync: Create user in Neon DB if not found
        try {
            const [newUser] = await db.insert(users).values({
                email,
                name: stackUser.displayName || email.split('@')[0],
                image: stackUser.profileImageUrl,
            }).returning();
            dbUser = newUser;
        } catch (error) {
            console.error("Failed to sync user to DB:", error);
            return null;
        }
    }

    // Auto-accept pending invitations (created by portal when company was registered)
    try {
        const pending = await db.query.invitations.findMany({
            where: and(
                eq(invitations.email, email),
                eq(invitations.status, 'pending')
            )
        });

        for (const inv of pending) {
            await db.insert(members).values({
                userId: dbUser.id,
                organizationId: inv.organizationId,
                role: inv.role as 'owner' | 'admin' | 'editor' | 'viewer',
            }).onConflictDoNothing();

            await db.update(invitations)
                .set({ status: 'accepted' })
                .where(eq(invitations.id, inv.id));
        }
    } catch (error) {
        console.error("Failed to accept pending invitations:", error);
    }

    return { ...dbUser, stackId: stackUser.id };
}
