import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth"; // Assuming NextAuth v5 setup

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect("/login"); // Or your login route
  }

  // 1. Get Organization by Slug
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    redirect("/404"); // Org not found
  }

  // 2. Check Membership
  // Note: We need to make sure session.user.id matches the userId stored in members table (string vs string)
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, org.id),
      eq(members.userId, session.user.id)
    ),
  });

  // If not a member and not a super-admin (logic to be added), deny access
  if (!membership) {
      // Optional: Check if user is super admin to bypass this
      // if (!isSuperAdmin(session.user.email)) {
      redirect("/unauthorized");
      // }
  }

  return (
    <div className="flex min-h-screen flex-col">
        {/* Pass org context to children if needed via Context Provider or just render */}
        {children}
    </div>
  );
}
