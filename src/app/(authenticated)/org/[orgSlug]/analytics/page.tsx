import { getLeads, getColumns } from "@/server/actions/leads";
import { getOrganizationBySlug } from "@/server/actions/organizations";
import { AnalyticsDashboard } from "@/components/features/crm/analytics-dashboard";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: { orgSlug: string };
    searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function AnalyticsPage(props: PageProps) {
    // Await params for Next.js 15 compatibility
    const params = await props.params; // If Next 14, this handles it gracefully too (sync object treated as value)
    const { orgSlug } = params;

    const org = await getOrganizationBySlug(orgSlug);

    if (!org) {
        return notFound();
    }

    // Now pass the IDs, not the slug
    const leads = await getLeads(org.id);
    const columns = await getColumns(org.id);

    return (
        <div className="p-6 h-full overflow-y-auto w-full max-w-[1600px] mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
                <p className="text-slate-500 dark:text-slate-400">Visão geral interativa do desempenho do seu CRM.</p>
            </div>

            <AnalyticsDashboard initialLeads={leads as any} columns={columns} />
        </div>
    );
}
