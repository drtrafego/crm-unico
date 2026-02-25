import { getLaunchLeads } from "@/server/actions/launch-leads";
import { LaunchLeadsClient } from "./client";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function LaunchLeadsPage({
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

    const leads = await getLaunchLeads(org.id);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Leads de Lançamento</h2>
            </div>
            <LaunchLeadsClient data={leads} />
        </div>
    );
}
