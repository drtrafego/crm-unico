import { getLaunchLeads, getLaunchAnalyticsData } from "@/server/actions/launch-leads";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function LaunchLeadsDebugPage({
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

    const analyticsRes = await getLaunchAnalyticsData(org.id);
    const analytics = analyticsRes.success ? analyticsRes.data : null;

    return (
        <div className="p-8 space-y-6 bg-slate-950 text-slate-200 min-h-screen font-mono text-sm">
            <h1 className="text-2xl font-bold text-white mb-4">Dashboard Diagnostic Log</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                    <h2 className="text-indigo-400 font-bold mb-2">Organization Info</h2>
                    <p>ID: {org.id}</p>
                    <p>Slug: {org.slug}</p>
                    <p>Sync Configured: {org.features?.launchSheetId ? "Yes" : "No"}</p>
                </section>

                <section className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                    <h2 className="text-emerald-400 font-bold mb-2">Analytics Status</h2>
                    <p>Success: {analyticsRes.success ? "YES" : "NO"}</p>
                    <p>Total Leads (Analytics): {analytics?.totalLeads ?? "N/A"}</p>
                    <p>Total Forms: {analytics?.totalForms ?? "N/A"}</p>
                </section>
            </div>

            <section className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                <h2 className="text-amber-400 font-bold mb-2">Array Integrity Checks</h2>
                <ul className="space-y-1">
                    {analytics ? Object.entries(analytics).map(([key, val]) => {
                        if (Array.isArray(val)) {
                            const hasNull = val.some(x => x === null || x === undefined);
                            const count = val.length;
                            return (
                                <li key={key} className={hasNull ? "text-red-400" : "text-slate-300"}>
                                    {key}: {count} items {hasNull ? "(⚠️ CONTAINS NULL/UNDEFINED)" : "(OK)"}
                                </li>
                            );
                        }
                        return null;
                    }) : <li>No analytics data available</li>}
                </ul>
            </section>

            <section className="p-4 rounded-lg bg-slate-900 border border-slate-700 overflow-x-auto">
                <h2 className="text-violet-400 font-bold mb-2">Raw Analytics Data (JSON)</h2>
                <pre className="text-[10px] leading-tight">
                    {JSON.stringify(analytics, null, 2)}
                </pre>
            </section>
        </div>
    );
}
