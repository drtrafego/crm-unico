import { getLeads, getColumns } from "@/server/actions/leads";
import { getSettings } from "@/server/actions/settings";
import { CrmView } from "@/components/features/crm/crm-view";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function CRMPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  const [leads, columns, settings] = await Promise.all([
    getLeads(org.id),
    getColumns(org.id),
    getSettings(org.id)
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      <CrmView
        initialLeads={leads}
        columns={columns}
        companyName={org.name}
        initialViewMode={settings?.viewMode || 'kanban'}
        orgId={org.id}
      />
    </div>
  );
}
