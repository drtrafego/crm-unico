import { getLeads, getColumns } from "@/server/actions/leads";
import { getOrganizationBySlug } from "@/server/actions/organizations";
import { getHotmartVendasAnalytics } from "@/server/actions/hotmart-analytics";
import { AnalyticsDashboard } from "@/components/features/crm/analytics-dashboard";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyticsPage(props: PageProps) {
    const { orgSlug } = await props.params;

    const org = await getOrganizationBySlug(orgSlug);

    if (!org) {
        return notFound();
    }

    const leads = await getLeads(org.id);
    const columns = await getColumns(org.id);
    const salesData = await getHotmartVendasAnalytics(org.id);

    return (
        <div className="p-6 h-full overflow-y-auto w-full max-w-[1600px] mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 italic tracking-tight">Intelligence & Analytics</h1>
                <p className="text-slate-500 dark:text-slate-400">Insights avançados e análise estatística do seu pipeline.</p>
            </div>

            <AnalyticsDashboard 
                initialLeads={leads as any} 
                columns={columns} 
                initialSales={salesData.success ? (salesData.data?.allSales as any) : []}
            />
        </div>
    );
}
