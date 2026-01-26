import { getLeads } from "@/server/actions/leads";
import { Lead } from "@/server/db/schema";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarView } from "@/components/features/crm/calendar-view";

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
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

  const leads: Lead[] = await getLeads(org.id);

  return <CalendarView leads={leads} />;
}
