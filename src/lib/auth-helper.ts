
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticatedUser() {
    const stackUser = await stackServerApp.getUser();
    if (!stackUser) return null;

    const email = stackUser.primaryEmail;
    if (!email) return null;

    // Sync: Find existing user in Neon DB
    const dbUser = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (dbUser) {
        return { ...dbUser, stackId: stackUser.id };
    }

    // Auto-Sync: Create user in Neon DB if not found
    try {
        const [newUser] = await db.insert(users).values({
            email,
            name: stackUser.displayName || email.split('@')[0],
            image: stackUser.profileImageUrl,
        }).returning();

        return { ...newUser, stackId: stackUser.id };
    } catch (error) {
        console.error("Failed to sync user to DB:", error);
        return null;
    }
}
