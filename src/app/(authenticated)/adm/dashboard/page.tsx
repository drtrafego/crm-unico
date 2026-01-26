import { auth } from "@/auth";
import { db } from "@/lib/db";
import { organizations, leads } from "@/server/db/schema";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { OrganizationsList } from "@/components/features/admin/organizations-list";
import { CreateOrgDialog } from "./create-org-dialog";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await auth();
  const userEmail = session?.user?.email;

  const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];

  if (!userEmail || !adminEmails.includes(userEmail)) {
    return redirect("/");
  }

  const allOrgs = await db.query.organizations.findMany({
    orderBy: [desc(organizations.createdAt)]
  });

  const orgsWithStats = await Promise.all(allOrgs.map(async (org) => {
    const orgLeads = await db.select({
      createdAt: leads.createdAt,
      firstContactAt: leads.firstContactAt
    })
      .from(leads)
      .where(eq(leads.organizationId, org.id));

    const totalLeads = orgLeads.length;

    // Calculate Avg Response Time
    const respondedLeads = orgLeads.filter(l => l.firstContactAt);
    let avgResponseTime = 0;

    if (respondedLeads.length > 0) {
      const totalTimeMs = respondedLeads.reduce((acc, lead) => {
        return acc + (lead.firstContactAt!.getTime() - lead.createdAt.getTime());
      }, 0);
      avgResponseTime = totalTimeMs / respondedLeads.length;
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      totalLeads,
      avgResponseTime
    };
  }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Painel Super Admin
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Gerencie todas as organizações e seus leads
            </p>
          </div>
          <CreateOrgDialog />
        </div>

        <OrganizationsList organizations={orgsWithStats} />
      </div>
    </div>
  );
}

