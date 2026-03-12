import { Lead, Column, VendaHotmart } from "@/server/db/schema";
import { differenceInDays, getHours, getDay } from "date-fns";

export interface DashboardInsights {
  leadScoreStats: {
    avgScore: number;
    distribution: { range: string; count: number }[];
    conversionsByGrade: Record<string, number>;
  };
  stagnationMetrics: {
    averageDaysToWin: number;
    stdDevDaysToWin: number;
    highRiskLeads: number;
  };
  attributionMetrics: {
    roiBySource: { 
      name: string; 
      revenue: number; 
      leads: number; 
      sales: number;
      conversionRate: number; 
      efficiencyScore: number;
    }[];
    roiByTerm: {
      name: string;
      revenue: number;
      leads: number;
      sales: number;
      conversionRate: number;
    }[];
    sourceStageMatrix: {
      source: string;
      stages: { name: string; count: number; percentage: number }[];
    }[];
    paretoSummary: {
      topSourceCount: number;
      topRevenuePercentage: number;
      isConcentrated: boolean;
    };
  };
  behavioralPeaks: {
    bestDay: string;
    bestHour: string;
  };
}

export function calculateAdvancedInsights(
  leads: Lead[],
  columns: Column[],
  sales: VendaHotmart[]
): DashboardInsights {
  const isWon = (l: Lead) => {
    const col = columns.find(c => c.id === l.columnId);
    return col ? /(fechado|won|ganho|vendido|contrato|sucesso)/.test(col.title.toLowerCase()) : false;
  };

  const wonLeads = leads.filter(isWon);
  const openLeads = leads.filter(l => !isWon(l));

  // 1. Lead Scoring (Predictive)
  const sourceConversionMap = new Map<string, number>();
  const totalBySource = new Map<string, number>();

  leads.forEach(l => {
    const src = l.utmSource || "Outros";
    totalBySource.set(src, (totalBySource.get(src) || 0) + 1);
    if (isWon(l)) {
      sourceConversionMap.set(src, (sourceConversionMap.get(src) || 0) + 1);
    }
  });

  const getSourceStrength = (src: string | null) => {
    const s = src || "Outros";
    const total = totalBySource.get(s) || 1;
    const won = sourceConversionMap.get(s) || 0;
    return won / total;
  };

  const calculateGrade = (score: number) => {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
  };

  const leadsWithScores = leads.map(l => {
    let score = 30;
    const strength = getSourceStrength(l.utmSource);
    score += Math.min(40, strength * 200);
    if (l.whatsapp) score += 10;
    if (l.email) score += 10;
    if (l.company) score += 10;
    const finalScore = Math.min(100, score);
    return { ...l, score: finalScore, grade: calculateGrade(finalScore) };
  });

  const avgScore = leadsWithScores.length ? Math.round(leadsWithScores.reduce((a, b) => a + b.score, 0) / leadsWithScores.length) : 0;
  
  const conversionsByGrade: Record<string, number> = {};
  ["A", "B", "C", "D", "F"].forEach(grade => {
    const group = leadsWithScores.filter(l => l.grade === grade);
    const won = group.filter(l => isWon(l)).length;
    conversionsByGrade[grade] = group.length ? Math.round((won / group.length) * 100) : 0;
  });

  const distribution = ["0-20", "21-40", "41-60", "61-80", "81-100"].map(r => {
    const [min, max] = r.split("-").map(Number);
    return {
      range: r,
      count: leadsWithScores.filter(s => s.score >= min && s.score <= max).length
    };
  });

  // 2. Stagnation (Statistical)
  const winCycles = wonLeads.map(l => {
    const created = new Date(l.createdAt);
    const now = new Date();
    return Math.max(1, differenceInDays(now, created));
  });

  const averageDaysToWin = winCycles.length ? Math.round(winCycles.reduce((a, b) => a + b, 0) / winCycles.length) : 0;
  const variance = winCycles.length ? winCycles.reduce((a, b) => a + Math.pow(b - averageDaysToWin, 2), 0) / winCycles.length : 0;
  const stdDevDaysToWin = Math.sqrt(variance);

  const stagnationDays = openLeads.map(l => differenceInDays(new Date(), new Date(l.createdAt)));
  const riskThreshold = averageDaysToWin + (1.5 * stdDevDaysToWin);
  const highRiskLeads = stagnationDays.filter(d => d > riskThreshold).length;

  // 3. Traffic Attribution & Performance Matrix
  const sourcePerformance = new Map<string, { revenue: number; leads: number; sales: number }>();
  const termPerformance = new Map<string, { revenue: number; leads: number; sales: number }>();
  
  // Track sales back to sources
  sales.forEach(s => {
    const price = parseFloat(s.price || "0");
    const src = s.utmSource || "Desconhecido";
    const term = s.utmTerm || "Direto/Orgânico";

    if (!sourcePerformance.has(src)) sourcePerformance.set(src, { revenue: 0, leads: 0, sales: 0 });
    const srcStat = sourcePerformance.get(src)!;
    srcStat.revenue += price;
    srcStat.sales += 1;

    if (!termPerformance.has(term)) termPerformance.set(term, { revenue: 0, leads: 0, sales: 0 });
    const termStat = termPerformance.get(term)!;
    termStat.revenue += price;
    termStat.sales += 1;
  });

  // Blend with lead volume for conversion rates
  totalBySource.forEach((count, src) => {
    if (!sourcePerformance.has(src)) sourcePerformance.set(src, { revenue: 0, leads: count, sales: 0 });
    else sourcePerformance.get(src)!.leads = count;
  });

  // Calculate Lead volume per term from CRM data
  leads.forEach(l => {
    const term = l.utmTerm || "Direto/Orgânico";
    if (!termPerformance.has(term)) termPerformance.set(term, { revenue: 0, leads: 1, sales: 0 });
    else termPerformance.get(term)!.leads += 1;
  });

  const roiBySource = Array.from(sourcePerformance.entries())
    .map(([name, stat]) => ({
      name,
      revenue: stat.revenue,
      leads: stat.leads,
      sales: stat.sales,
      conversionRate: stat.leads > 0 ? (stat.sales / stat.leads) * 100 : 0,
      efficiencyScore: (stat.revenue > 0 && stat.leads > 0) ? (stat.revenue / stat.leads) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue || b.conversionRate - a.conversionRate);

  const roiByTerm = Array.from(termPerformance.entries())
    .filter(([name]) => name !== "Direto/Orgânico" || sourcePerformance.size > 1) // Filter if relevant
    .map(([name, stat]) => ({
      name,
      revenue: stat.revenue,
      leads: stat.leads,
      sales: stat.sales,
      conversionRate: stat.leads > 0 ? (stat.sales / stat.leads) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const totalRevenue = roiBySource.reduce((a, b) => a + b.revenue, 0);
  let runningTotal = 0;
  let topSourceCount = 0;
  roiBySource.forEach(r => {
    if (runningTotal < totalRevenue * 0.8) {
      runningTotal += r.revenue;
      topSourceCount++;
    }
  });

  const topRevenuePercentage = totalRevenue > 0 ? (runningTotal / totalRevenue) * 100 : 0;

  // 4. Behavioral Peaks
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayCounts: Record<number, number> = {};
  const hourCounts: Record<number, number> = {};

  wonLeads.forEach(l => {
    const dt = new Date(l.createdAt);
    const d = getDay(dt);
    const h = getHours(dt);
    dayCounts[d] = (dayCounts[d] || 0) + 1;
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });

  const bestDayIdx = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
  const bestHourIdx = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 14;

  // 5. Deep Funnel Matrix (Traffic -> Specific Stages)
  const topSources = roiBySource.slice(0, 5).map(s => s.name);
  const relevantStages = columns.sort((a, b) => a.order - b.order); // Order columns by funnel order

  const sourceStageMatrix = topSources.map(sourceName => {
    const sourceLeads = leads.filter(l => (l.utmSource || "Outros") === sourceName);
    const stagesPerformance = relevantStages.map(col => {
      const count = sourceLeads.filter(l => l.columnId === col.id).length;
      return {
        name: col.title,
        count,
        percentage: sourceLeads.length > 0 ? (count / sourceLeads.length) * 100 : 0
      };
    });
    return { source: sourceName, stages: stagesPerformance };
  });

  return {
    leadScoreStats: { avgScore, distribution, conversionsByGrade },
    stagnationMetrics: { averageDaysToWin, stdDevDaysToWin, highRiskLeads },
    attributionMetrics: { 
      roiBySource, 
      roiByTerm,
      sourceStageMatrix,
      paretoSummary: { 
        topSourceCount: Math.max(1, topSourceCount), 
        topRevenuePercentage,
        isConcentrated: topSourceCount <= (roiBySource.length * 0.2)
      } 
    },
    behavioralPeaks: {
      bestDay: dayLabels[Number(bestDayIdx)],
      bestHour: `${bestHourIdx}:00`
    }
  };
}
