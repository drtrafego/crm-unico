import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-helper";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getAuthenticatedUser();
  const { orgSlug } = await params;

  if (!session?.id) {
    redirect("/handler/sign-in"); // Redirect to Stack Auth
  }

  // 1. Get Organization by Slug
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    redirect("/404"); // Org not found
  }

  // 2. Check Membership
  // Note: We need to make sure session.id matches the userId stored in members table (string vs string)
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, org.id),
      eq(members.userId, session.id)
    ),
  });

  const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
  const isSuperAdmin = session.email && adminEmails.includes(session.email);

  // If not a member and not a super-admin, deny access
  if (!membership && !isSuperAdmin) {
    redirect("/unauthorized");
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Pass org context to children if needed via Context Provider or just render */}
      {children}
    </div>
  );
}
