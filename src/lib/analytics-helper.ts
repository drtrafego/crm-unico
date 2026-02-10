import { Lead } from "@/server/db/schema";
import { getLeadSource } from "./leads-helper";

export interface AnalyticsData {
    sourceData: { name: string; value: number }[];
    campaignData: { name: string; leads: number }[];
    pageData: { name: string; leads: number }[];
    conversionBySource: { name: string; total: number; won: number; rate: number }[];
}

export function processAnalyticsData(leads: Lead[]): AnalyticsData {
    const sourceMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();
    const pageMap = new Map<string, number>();
    const conversionMap = new Map<string, { total: number; won: number }>();

    leads.forEach((lead) => {
        // 1. Source (Normalized)
        const source = getLeadSource(lead);
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

        // 2. Campaign (UTM Campaign)
        if (lead.utmCampaign) {
            const campaign = lead.utmCampaign; // Keep raw for now, maybe normalize case?
            campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
        }

        // 3. Page (Slug/PagePath)
        if (lead.pagePath) {
            // Clean slug: remove query params, maybe protocol/domain if stored fully
            let cleanPath = lead.pagePath;
            try {
                if (cleanPath.startsWith('http')) {
                    cleanPath = new URL(cleanPath).pathname;
                }
            } catch (e) {
                // ignore
            }
            // remove trailing slash if not root
            if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
                cleanPath = cleanPath.slice(0, -1);
            }

            pageMap.set(cleanPath, (pageMap.get(cleanPath) || 0) + 1);
        }

        // 4. Conversion Rate
        if (!conversionMap.has(source)) {
            conversionMap.set(source, { total: 0, won: 0 });
        }
        const stat = conversionMap.get(source)!;
        stat.total += 1;

        // Check if won (using vague logic for now, ideally pass columns to check "won" status accurately)
        // For now getting status text or checking value presence as a proxy if status is not available?
        // Actually, `lead.status` is a string ID or similar. `columnId` is better.
        // Since we don't have columns here easily without passing them, we might skip "Won" check in helper 
        // OR pass columns. Let's pass columns to be precise, but for now I'll create the structure 
        // and letting the component logic handle the "isWon" check might be better?
        // Better: let's verify if we can pass columns. Yes, we can.
        // UPDATED: I will add columns param.
    });

    // Transform Maps to Arrays and Sort
    const sourceData = Array.from(sourceMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const campaignData = Array.from(campaignMap.entries())
        .map(([name, leads]) => ({ name, leads }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10); // Top 10

    const pageData = Array.from(pageMap.entries())
        .map(([name, leads]) => ({ name, leads }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10); // Top 10

    return {
        sourceData,
        campaignData,
        pageData,
        conversionBySource: [] // Placeholder until we fix the "Won" logic in next step
    };
}

export function calculateConversionBySource(leads: Lead[], isWon: (lead: Lead) => boolean) {
    const conversionMap = new Map<string, { total: number; won: number }>();

    leads.forEach(lead => {
        const source = getLeadSource(lead);
        if (!conversionMap.has(source)) {
            conversionMap.set(source, { total: 0, won: 0 });
        }
        const stat = conversionMap.get(source)!;
        stat.total += 1;
        if (isWon(lead)) {
            stat.won += 1;
        }
    });

    return Array.from(conversionMap.entries())
        .map(([name, stat]) => ({
            name,
            total: stat.total,
            won: stat.won,
            rate: stat.total > 0 ? Math.round((stat.won / stat.total) * 100) : 0
        }))
        .sort((a, b) => b.rate - a.rate);
}
