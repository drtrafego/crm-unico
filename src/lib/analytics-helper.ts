import { Lead, Column } from "@/server/db/schema";
import { getLeadSource } from "./leads-helper";
import { differenceInDays, startOfDay } from "date-fns";

// ========== BASIC ANALYTICS (unchanged) ==========

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

    leads.forEach((lead) => {
        const source = getLeadSource(lead);
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

        if (lead.utmCampaign || lead.campaignSource) {
            const campaign = lead.utmCampaign || lead.campaignSource || "Desconhecido";
            campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
        }

        if (lead.pagePath) {
            let cleanPath = lead.pagePath;
            try {
                if (cleanPath.startsWith('http')) cleanPath = new URL(cleanPath).pathname;
            } catch { /* ignore */ }
            if (cleanPath.length > 1 && cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
            pageMap.set(cleanPath, (pageMap.get(cleanPath) || 0) + 1);
        }
    });

    const sourceData = Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const campaignData = Array.from(campaignMap.entries()).map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads).slice(0, 10);
    const pageData = Array.from(pageMap.entries()).map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads).slice(0, 10);

    return { sourceData, campaignData, pageData, conversionBySource: [] };
}

export function calculateConversionBySource(leads: Lead[], isWon: (lead: Lead) => boolean) {
    const conversionMap = new Map<string, { total: number; won: number }>();
    leads.forEach(lead => {
        const source = getLeadSource(lead);
        if (!conversionMap.has(source)) conversionMap.set(source, { total: 0, won: 0 });
        const stat = conversionMap.get(source)!;
        stat.total += 1;
        if (isWon(lead)) stat.won += 1;
    });
    return Array.from(conversionMap.entries())
        .map(([name, stat]) => ({ name, total: stat.total, won: stat.won, rate: stat.total > 0 ? Math.round((stat.won / stat.total) * 100) : 0 }))
        .sort((a, b) => b.rate - a.rate);
}

// ========== SALES INTELLIGENCE v3 ==========

export interface StaleLead {
    id: string;
    name: string;
    stageName: string;
    daysStale: number;
    notes: string | null;
    value: string | number | null;
}

export interface StaleAlerts {
    critical: StaleLead[];   // > 15 days
    warning: StaleLead[];    // 7-15 days
    healthy: number;         // < 7 days
    totalOpen: number;
}

export function getStaleAlerts(
    leads: Lead[],
    columns: Column[],
    isWon: (l: Lead) => boolean,
    isLost: (l: Lead) => boolean
): StaleAlerts {
    const today = startOfDay(new Date());
    const openLeads = leads.filter(l => !isWon(l) && !isLost(l));

    const critical: StaleLead[] = [];
    const warning: StaleLead[] = [];
    let healthy = 0;

    openLeads.forEach(lead => {
        const created = lead.createdAt ? new Date(lead.createdAt) : new Date();
        const days = differenceInDays(today, created);
        const col = columns.find(c => c.id === lead.columnId);
        const stageName = col?.title || 'Sem etapa';

        const staleLead: StaleLead = {
            id: lead.id,
            name: lead.name,
            stageName,
            daysStale: days,
            notes: lead.notes,
            value: lead.value,
        };

        if (days > 15) critical.push(staleLead);
        else if (days > 7) warning.push(staleLead);
        else healthy++;
    });

    // Sort by most stale first
    critical.sort((a, b) => b.daysStale - a.daysStale);
    warning.sort((a, b) => b.daysStale - a.daysStale);

    return { critical, warning, healthy, totalOpen: openLeads.length };
}

export interface FunnelStage {
    name: string;
    count: number;
    percentage: number; // relative to first stage
    dropOff: number;    // % drop from previous stage
    color: string;
}

export function getFunnelData(leads: Lead[], columns: Column[]): FunnelStage[] {
    // Order columns by their 'order' field
    const orderedCols = [...columns].sort((a, b) => a.order - b.order);

    const stages: FunnelStage[] = [];
    let firstCount = 0;
    let prevCount = 0;

    orderedCols.forEach((col, idx) => {
        const count = leads.filter(l => l.columnId === col.id).length;
        if (idx === 0) {
            firstCount = count || 1; // avoid divide by zero
            prevCount = count;
        }

        const percentage = Math.round((count / firstCount) * 100);
        const dropOff = idx === 0 ? 0 : (prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0);

        stages.push({
            name: col.title,
            count,
            percentage,
            dropOff,
            color: col.color || '#6366f1',
        });
        prevCount = count;
    });

    return stages;
}

export interface VelocityMetrics {
    avgDaysToClose: number;
    avgDaysToLose: number;
    avgDaysByStage: { stage: string; avgDays: number }[];
    fastestClose: number | null;
    slowestClose: number | null;
}

export function getVelocityMetrics(
    leads: Lead[],
    columns: Column[],
    isWon: (l: Lead) => boolean,
    isLost: (l: Lead) => boolean
): VelocityMetrics {
    const today = new Date();
    const wonLeads = leads.filter(isWon);
    const lostLeads = leads.filter(isLost);

    const getDays = (lead: Lead) => {
        const created = lead.createdAt ? new Date(lead.createdAt) : today;
        return differenceInDays(today, created);
    };

    const wonDays = wonLeads.map(getDays);
    const lostDays = lostLeads.map(getDays);

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    // Average time in each stage (for open leads)
    const openLeads = leads.filter(l => !isWon(l) && !isLost(l));
    const stageMap = new Map<string, number[]>();
    openLeads.forEach(lead => {
        const col = columns.find(c => c.id === lead.columnId);
        const stageName = col?.title || 'Sem etapa';
        if (!stageMap.has(stageName)) stageMap.set(stageName, []);
        stageMap.get(stageName)!.push(getDays(lead));
    });

    const avgDaysByStage = Array.from(stageMap.entries())
        .map(([stage, days]) => ({ stage, avgDays: avg(days) }))
        .sort((a, b) => b.avgDays - a.avgDays);

    return {
        avgDaysToClose: avg(wonDays),
        avgDaysToLose: avg(lostDays),
        avgDaysByStage,
        fastestClose: wonDays.length ? Math.min(...wonDays) : null,
        slowestClose: wonDays.length ? Math.max(...wonDays) : null,
    };
}

export interface FollowUpMetrics {
    overdueLeads: { id: string; name: string; followUpDate: Date; daysOverdue: number; notes: string | null }[];
    upcomingLeads: { id: string; name: string; followUpDate: Date; daysUntil: number }[];
    complianceRate: number; // % of follow-ups that are NOT overdue
    totalWithFollowUp: number;
}

export function getFollowUpMetrics(
    leads: Lead[],
    isWon: (l: Lead) => boolean,
    isLost: (l: Lead) => boolean
): FollowUpMetrics {
    const today = startOfDay(new Date());
    const openLeads = leads.filter(l => !isWon(l) && !isLost(l));

    const withFollowUp = openLeads.filter(l => l.followUpDate);
    const overdue: FollowUpMetrics['overdueLeads'] = [];
    const upcoming: FollowUpMetrics['upcomingLeads'] = [];

    withFollowUp.forEach(lead => {
        const fuDate = new Date(lead.followUpDate!);
        const diff = differenceInDays(fuDate, today);

        if (diff < 0) {
            overdue.push({
                id: lead.id,
                name: lead.name,
                followUpDate: fuDate,
                daysOverdue: Math.abs(diff),
                notes: lead.followUpNote || lead.notes,
            });
        } else {
            upcoming.push({
                id: lead.id,
                name: lead.name,
                followUpDate: fuDate,
                daysUntil: diff,
            });
        }
    });

    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    const complianceRate = withFollowUp.length > 0
        ? Math.round((upcoming.length / withFollowUp.length) * 100)
        : 100;

    return {
        overdueLeads: overdue,
        upcomingLeads: upcoming.slice(0, 5),
        complianceRate,
        totalWithFollowUp: withFollowUp.length,
    };
}

export interface HealthScore {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    factors: { label: string; impact: number; status: 'positive' | 'warning' | 'critical' }[];
}

export function getHealthScore(
    staleAlerts: StaleAlerts,
    followUpMetrics: FollowUpMetrics,
    velocityMetrics: VelocityMetrics,
    totalLeads: number,
    wonLeads: number
): HealthScore {
    let score = 50; // baseline
    const factors: HealthScore['factors'] = [];

    // Factor 1: Stale ratio (max ±20 points)
    if (staleAlerts.totalOpen > 0) {
        const criticalRatio = staleAlerts.critical.length / staleAlerts.totalOpen;
        if (criticalRatio > 0.3) {
            score -= 20;
            factors.push({ label: `${staleAlerts.critical.length} leads parados há +15 dias`, impact: -20, status: 'critical' });
        } else if (criticalRatio > 0.1) {
            score -= 10;
            factors.push({ label: `${staleAlerts.critical.length} leads parados há +15 dias`, impact: -10, status: 'warning' });
        } else {
            score += 10;
            factors.push({ label: 'Poucos leads parados', impact: 10, status: 'positive' });
        }
    }

    // Factor 2: Follow-up compliance (max ±15 points)
    if (followUpMetrics.totalWithFollowUp > 0) {
        if (followUpMetrics.complianceRate >= 80) {
            score += 15;
            factors.push({ label: `Follow-ups em dia (${followUpMetrics.complianceRate}%)`, impact: 15, status: 'positive' });
        } else if (followUpMetrics.complianceRate >= 50) {
            score += 0;
            factors.push({ label: `${followUpMetrics.overdueLeads.length} follow-ups vencidos`, impact: 0, status: 'warning' });
        } else {
            score -= 15;
            factors.push({ label: `${followUpMetrics.overdueLeads.length} follow-ups vencidos`, impact: -15, status: 'critical' });
        }
    }

    // Factor 3: Conversion rate (max ±15 points)
    if (totalLeads > 0) {
        const convRate = (wonLeads / totalLeads) * 100;
        if (convRate >= 20) {
            score += 15;
            factors.push({ label: `Taxa de conversão alta (${convRate.toFixed(0)}%)`, impact: 15, status: 'positive' });
        } else if (convRate >= 10) {
            score += 5;
            factors.push({ label: `Taxa de conversão OK (${convRate.toFixed(0)}%)`, impact: 5, status: 'positive' });
        } else {
            score -= 5;
            factors.push({ label: `Taxa de conversão baixa (${convRate.toFixed(0)}%)`, impact: -5, status: 'warning' });
        }
    }

    // Factor 4: Pipeline activity (healthy leads ratio)
    if (staleAlerts.totalOpen > 0) {
        const healthyRatio = staleAlerts.healthy / staleAlerts.totalOpen;
        if (healthyRatio >= 0.5) {
            score += 10;
            factors.push({ label: `${staleAlerts.healthy} leads com atividade recente`, impact: 10, status: 'positive' });
        }
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));

    let grade: HealthScore['grade'] = 'F';
    if (score >= 80) grade = 'A';
    else if (score >= 65) grade = 'B';
    else if (score >= 50) grade = 'C';
    else if (score >= 35) grade = 'D';

    return { score, grade, factors };
}
