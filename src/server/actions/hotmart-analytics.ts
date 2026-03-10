"use server";

import { db } from "@/lib/db";
import { vendasHotmart, leads, launchLeads } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getHotmartVendasAnalytics(organizationId: string) {
    try {
        // 1. Fetch all Hotmart sales for this organization
        const sales = await db.query.vendasHotmart.findMany({
            where: eq(vendasHotmart.organizationId, organizationId),
            orderBy: [desc(vendasHotmart.createdAt)],
        });

        // 2. Fetch all Leads (CRM and Launch) for matching
        const crmLeads = await db.query.leads.findMany({
            where: eq(leads.organizationId, organizationId),
            columns: { email: true, whatsapp: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true }
        });

        const sheetLeads = await db.query.launchLeads.findMany({
            where: eq(launchLeads.organizationId, organizationId),
            columns: { email: true, whatsapp: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true }
        });

        // 3. Helper to normalize phone (last 7 digits)
        const normalizePhone = (p: string | null | undefined) => {
            if (!p) return null;
            const digits = p.replace(/\D/g, '');
            return digits.length >= 7 ? digits.slice(-7) : digits;
        };

        // 4. Create Maps for fast matching
        const leadsByEmail = new Map<string, typeof crmLeads[0]>();
        const leadsByPhone = new Map<string, typeof crmLeads[0]>();

        // Process CRM leads first (higher priority for UTMs)
        [...crmLeads, ...sheetLeads].forEach(l => {
            if (l.email) {
                const lowerEmail = l.email.toLowerCase();
                if (!leadsByEmail.has(lowerEmail)) leadsByEmail.set(lowerEmail, l);
            }
            const phone7 = normalizePhone(l.whatsapp);
            if (phone7 && !leadsByPhone.has(phone7)) {
                leadsByPhone.set(phone7, l);
            }
        });

        // 5. KPIs and Aggregations
        let totalValue = 0;
        const salesCount = sales.length;
        const statusCounts: Record<string, { count: number; value: number }> = {};
        const paymentTypeCounts: Record<string, { count: number; value: number }> = {};
        const stateCounts: Record<string, { count: number; value: number }> = {};
        const cityCounts: Record<string, { count: number; value: number }> = {};
        const sckCounts: Record<string, { count: number; value: number }> = {};
        const scrCounts: Record<string, { count: number; value: number }> = {};

        // Attribution Aggregations (Only forMatched Sales)
        const utmSourceCounts: Record<string, number> = {};
        const utmMediumCounts: Record<string, number> = {};
        const utmCampaignCounts: Record<string, number> = {};
        const utmTermCounts: Record<string, number> = {};
        const utmContentCounts: Record<string, number> = {};

        sales.forEach(s => {
            const price = parseFloat(s.price || "0");
            totalValue += price;

            // Basic Counts
            const st = s.status || "Unknown";
            if (!statusCounts[st]) statusCounts[st] = { count: 0, value: 0 };
            statusCounts[st].count++;
            statusCounts[st].value += price;

            const pt = s.paymentType || "Other";
            if (!paymentTypeCounts[pt]) paymentTypeCounts[pt] = { count: 0, value: 0 };
            paymentTypeCounts[pt].count++;
            paymentTypeCounts[pt].value += price;

            const state = s.state || "Other";
            if (!stateCounts[state]) stateCounts[state] = { count: 0, value: 0 };
            stateCounts[state].count++;
            stateCounts[state].value += price;

            const city = s.city || "Other";
            const cityKey = `${city} (${state})`;
            if (!cityCounts[cityKey]) cityCounts[cityKey] = { count: 0, value: 0 };
            cityCounts[cityKey].count++;
            cityCounts[cityKey].value += price;

            const sck = s.sck || "None";
            if (!sckCounts[sck]) sckCounts[sck] = { count: 0, value: 0 };
            sckCounts[sck].count++;
            sckCounts[sck].value += price;

            const scr = s.scr || "None";
            if (!scrCounts[scr]) scrCounts[scr] = { count: 0, value: 0 };
            scrCounts[scr].count++;
            scrCounts[scr].value += price;

            // Matching Logic
            const phone7 = normalizePhone(s.buyerPhone);
            const matchedLead = leadsByEmail.get(s.buyerEmail.toLowerCase()) || (phone7 ? leadsByPhone.get(phone7) : null);

            if (matchedLead) {
                const src = matchedLead.utmSource || "Outros";
                utmSourceCounts[src] = (utmSourceCounts[src] || 0) + 1;

                const med = matchedLead.utmMedium || "Outros";
                utmMediumCounts[med] = (utmMediumCounts[med] || 0) + 1;

                const camp = matchedLead.utmCampaign || "Outros";
                utmCampaignCounts[camp] = (utmCampaignCounts[camp] || 0) + 1;

                const term = matchedLead.utmTerm || "Outros";
                utmTermCounts[term] = (utmTermCounts[term] || 0) + 1;

                const cont = matchedLead.utmContent || "Outros";
                utmContentCounts[cont] = (utmContentCounts[cont] || 0) + 1;
            } else {
                utmSourceCounts["Desconhecido"] = (utmSourceCounts["Desconhecido"] || 0) + 1;
            }
        });

        const allMatchedSales = sales.map(s => {
            const price = parseFloat(s.price || "0");
            const phone7 = normalizePhone(s.buyerPhone);
            const matchedLead = leadsByEmail.get(s.buyerEmail.toLowerCase()) || (phone7 ? leadsByPhone.get(phone7) : null);

            return {
                id: s.id,
                price,
                status: s.status || "Unknown",
                paymentType: s.paymentType || "Other",
                utmSource: matchedLead?.utmSource || "Desconhecido",
                utmMedium: matchedLead?.utmMedium || "Outros",
                utmCampaign: matchedLead?.utmCampaign || "Outros",
                utmTerm: matchedLead?.utmTerm || "Outros",
                utmContent: matchedLead?.utmContent || "Outros",
                sck: s.sck || "None",
                scr: s.scr || "None",
                state: s.state || "Other",
                city: s.city || "Other",
                purchaseDate: s.purchaseDate,
                buyerName: s.buyerName,
                buyerEmail: s.buyerEmail
            };
        });

        return {
            success: true,
            data: {
                summary: {
                    totalValue,
                    salesCount,
                    totalLeads: leadsByEmail.size + (crmLeads.filter(l => !l.email).length + sheetLeads.filter(l => !l.email).length),
                    capturedCount: crmLeads.length,
                    formCount: sheetLeads.length,
                    matchedCount: allMatchedSales.filter(s => s.utmSource !== "Desconhecido").length
                },
                allSales: allMatchedSales,
                recentSales: sales.slice(0, 10)
            }
        };

    } catch (error) {
        console.error("Error fetching Hotmart analytics:", error);
        return { success: false, error: "Failed to fetch Hotmart analytics" };
    }
}
