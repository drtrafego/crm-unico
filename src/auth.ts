import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/lib/db"
import { invitations, members, users } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  secret: process.env.AUTH_SECRET, // Explicitly providing the secret
  events: {
    async signIn({ user }) {
      if (!user.email || !user.id) return;

      // 1. Find pending invitations for this email
      const pendingInvites = await db.query.invitations.findMany({
        where: and(
          eq(invitations.email, user.email),
          eq(invitations.status, 'pending')
        )
      });

      if (pendingInvites.length > 0) {
        console.log(`[Auth] Processing ${pendingInvites.length} invitations for ${user.email}`);

        for (const invite of pendingInvites) {
          // Check if already member (safety check)
          const existingMember = await db.query.members.findFirst({
            where: and(
              eq(members.organizationId, invite.organizationId),
              eq(members.userId, user.id)
            )
          });

          if (!existingMember) {
            // Create member
            await db.insert(members).values({
              userId: user.id,
              organizationId: invite.organizationId,
              role: invite.role as any
            });
            console.log(`[Auth] Added member to org ${invite.organizationId}`);
          }

          // Mark invitation as accepted
          await db.update(invitations)
            .set({ status: 'accepted' })
            .where(eq(invitations.id, invite.id));
        }
      }
    }
  }
})
