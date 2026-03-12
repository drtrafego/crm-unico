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
    roiBySource: { name: string; revenue: number; leads: number; conversion: number; roi: number }[];
    paretoAnalysis: { name: string; revenue: number; cumulativePercentage: number }[];
    paretoSummary: {
      topSourceCount: number;
      topRevenuePercentage: number;
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

  // 3. Attribution & Pareto
  const revenueMap = new Map<string, { revenue: number; leads: number }>();
  
  sales.forEach(s => {
    const src = s.utmSource || "Desconhecido";
    if (!revenueMap.has(src)) revenueMap.set(src, { revenue: 0, leads: 0 });
    const stat = revenueMap.get(src)!;
    stat.revenue += parseFloat(s.price || "0");
  });

  totalBySource.forEach((count, src) => {
    if (!revenueMap.has(src)) revenueMap.set(src, { revenue: 0, leads: 0 });
    revenueMap.get(src)!.leads = count;
  });

  const roiBySource = Array.from(revenueMap.entries())
    .map(([name, stat]) => ({
      name,
      revenue: stat.revenue,
      leads: stat.leads,
      conversion: stat.leads > 0 ? (stat.revenue / stat.leads) : 0,
      roi: stat.leads > 0 ? (stat.revenue / (stat.leads * 50)) : 0 // Assuming 50 BRL lead cost
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = roiBySource.reduce((a, b) => a + b.revenue, 0);
  let runningTotal = 0;
  let topSourceCount = 0;
  const paretoAnalysis = roiBySource.map(r => {
    runningTotal += r.revenue;
    const perc = totalRevenue > 0 ? (runningTotal / totalRevenue) : 0;
    if (perc <= 0.8) topSourceCount++;
    return {
      name: r.name,
      revenue: r.revenue,
      cumulativePercentage: Math.round(perc * 100)
    };
  });

  const topRevenuePercentage = totalRevenue > 0 ? (roiBySource.slice(0, Math.max(1, topSourceCount)).reduce((a, b) => a + b.revenue, 0) / totalRevenue) * 100 : 0;

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

  return {
    leadScoreStats: { avgScore, distribution, conversionsByGrade },
    stagnationMetrics: { averageDaysToWin, stdDevDaysToWin, highRiskLeads },
    attributionMetrics: { 
      roiBySource, 
      paretoAnalysis, 
      paretoSummary: { topSourceCount: Math.max(1, topSourceCount), topRevenuePercentage } 
    },
    behavioralPeaks: {
      bestDay: dayLabels[Number(bestDayIdx)],
      bestHour: `${bestHourIdx}:00`
    }
  };
}
