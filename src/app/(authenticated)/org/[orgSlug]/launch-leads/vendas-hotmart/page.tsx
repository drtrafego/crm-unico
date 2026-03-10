import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getHotmartVendasAnalytics } from "@/server/actions/hotmart-analytics";
import { VendasHotmartClient } from "./client";

export default async function VendasHotmartPage({
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

    const analyticsRes = await getHotmartVendasAnalytics(org.id);
    const analytics = analyticsRes.success && analyticsRes.data ? analyticsRes.data : null;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Vendas Hotmart</h2>
            </div>
            <VendasHotmartClient data={analytics} />
        </div>
    );
}
