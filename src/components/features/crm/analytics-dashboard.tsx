"use client";

import { useMemo, useState } from "react";
import { Lead, Column, VendaHotmart } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    AreaChart, Area, PieChart, Pie, Legend
} from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, Clock, CalendarClock,
    RotateCcw, Gem, BrainCircuit, Link2,
    AlertTriangle, Activity, Zap, Timer, DollarSign, Filter,
    CheckCircle2, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI } from "./analytics-components";
import { getLeadSource } from "@/lib/leads-helper";
import { processAnalyticsData, getStaleAlerts, getFunnelData, getVelocityMetrics, getFollowUpMetrics, getHealthScore } from "@/lib/analytics-helper";
import { calculateAdvancedInsights } from "@/lib/insights-helper";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

// --- Colors & Helpers ---
const PIPELINE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9"];

const DD_TO_STATE: Record<string, string> = {
    '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
    '21': 'RJ', '22': 'RJ', '24': 'RJ', '27': 'ES', '28': 'ES', '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG',
    '35': 'MG', '37': 'MG', '38': 'MG', '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
    '47': 'SC', '48': 'SC', '49': 'SC', '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS', '61': 'DF', '62': 'GO',
    '64': 'GO', '63': 'TO', '65': 'MT', '66': 'MT', '67': 'MS', '68': 'AC', '69': 'RO', '71': 'BA', '73': 'BA',
    '74': 'BA', '75': 'BA', '77': 'BA', '79': 'SE', '81': 'PE', '87': 'PE', '82': 'AL', '83': 'PB', '84': 'RN',
    '85': 'CE', '88': 'CE', '86': 'PI', '89': 'PI', '91': 'PA', '93': 'PA', '94': 'PA', '92': 'AM', '97': 'AM',
    '95': 'RR', '96': 'AP', '98': 'MA', '99': 'MA'
};

const getStateFromPhone = (phone?: string | null) => {
    if (!phone) return 'Desc.';
    let clean = phone.replace(/\D/g, '') || '';
    if (clean.length >= 12 && clean.startsWith('55')) clean = clean.substring(2);
    if (clean.length < 10) return 'Desc.';
    return DD_TO_STATE[clean.substring(0, 2)] || 'Outros';
};

const parseValue = (val: string | number | null | undefined) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

interface AnalyticsDashboardProps {
    initialLeads: Lead[];
    columns: Column[];
    initialSales: VendaHotmart[];
}

export function AnalyticsDashboard({ initialLeads, columns, initialSales }: AnalyticsDashboardProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 90),
        to: new Date()
    });
    const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
    const [selectedState, setSelectedState] = useState<string>("all");
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

    // Cross-filtering states
    const [selectedUTMSource, setSelectedUTMSource] = useState<string | null>(null);
    const [selectedUTMTerm, setSelectedUTMTerm] = useState<string | null>(null);
    const [selectedPage, setSelectedPage] = useState<string | null>(null);

    // ROI Simulator State
    const [cpaValue, setCpaValue] = useState<number>(30); // Default CPA 30 BRL

    const {
        kpis, charts, uniqueOrigins, states, 
        intelligence, utmStats
    } = useMemo(() => {
        const checkStatus = (title: string, type: 'won' | 'lost') => {
            const t = title.toLowerCase();
            if (type === 'won') return /(fechado|won|ganho|vendido|contrato|sucesso)/.test(t) && !t.includes('não');
            if (type === 'lost') return /(perdido|lost|arquivado|desqualificado|cancelado|não|sem retorno)/.test(t);
            return false;
        };

        const isLeadWon = (lead: Lead) => {
            if (!lead.columnId) return false;
            const col = columns.find(c => c.id === lead.columnId);
            return col ? checkStatus(col.title, 'won') : false;
        };

        const isLeadLost = (lead: Lead) => {
            if (!lead.columnId) return false;
            const col = columns.find(c => c.id === lead.columnId);
            return col ? checkStatus(col.title, 'lost') : false;
        };

        const filtered = initialLeads.filter(lead => {
            if (dateRange?.from) {
                const start = startOfDay(dateRange.from);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
                if (!isWithinInterval(createdAt, { start, end })) return false;
            }
            if (selectedOrigin !== "all" && getLeadSource(lead) !== selectedOrigin) return false;
            if (selectedState !== "all" && getStateFromPhone(lead.whatsapp) !== selectedState) return false;

            if (selectedUTMSource && lead.utmSource !== selectedUTMSource) return false;
            if (selectedUTMTerm && lead.utmTerm !== selectedUTMTerm) return false;
            if (selectedPage) {
                let cleanPath = lead.pagePath || "Home";
                try {
                    if (cleanPath.startsWith('http')) {
                        const url = new URL(cleanPath);
                        cleanPath = url.pathname === '/' ? 'Home' : url.pathname;
                    }
                } catch { /* ignore */ }
                if (cleanPath.length > 1 && cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
                if (cleanPath === '/') cleanPath = 'Home';
                if (cleanPath !== selectedPage) return false;
            }

            return true;
        });

        const activeLeads = filtered.filter(lead => {
            if (selectedColumn && lead.columnId !== columns.find(c => c.title === selectedColumn)?.id) return false;
            return true;
        });

        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => getLeadSource(l)))).sort();
        const states = Array.from(new Set(initialLeads.map(l => getStateFromPhone(l.whatsapp)))).sort();

        // KPIs
        const totalLeadsCount = activeLeads.length;
        const wonLeadsList = activeLeads.filter(isLeadWon);
        const openLeadsList = activeLeads.filter(l => !isLeadWon(l) && !isLeadLost(l));

        const revenue = wonLeadsList.reduce((acc, l) => acc + parseValue(l.value), 0);
        const pipeline = openLeadsList.reduce((acc, l) => acc + parseValue(l.value), 0);
        const conversionRate = totalLeadsCount ? (wonLeadsList.length / totalLeadsCount) * 100 : 0;
        const averageTicket = wonLeadsList.length ? revenue / wonLeadsList.length : 0;
        const avgCycle = wonLeadsList.length
            ? Math.round(wonLeadsList.reduce((acc, l) => acc + differenceInDays(new Date(), l.createdAt ? new Date(l.createdAt) : new Date()), 0) / wonLeadsList.length)
            : 0;
        const followUpsCount = activeLeads.filter(l => l.followUpDate && startOfDay(new Date(l.followUpDate)) >= startOfDay(new Date())).length;

        // Charts
        const monthlyDataMap: Record<string, { month: string, leads: number, revenue: number, sortDate: Date }> = {};
        activeLeads.forEach(l => {
            if (!l.createdAt) return;
            // Apply UTC-3 offset (Buenos Aires/Brazil)
            const date = subHours(new Date(l.createdAt), 3);
            const m = format(date, 'MMM/yy', { locale: ptBR });
            if (!monthlyDataMap[m]) monthlyDataMap[m] = { month: m, leads: 0, revenue: 0, sortDate: startOfDay(date) };
            monthlyDataMap[m].leads++;
            if (isLeadWon(l)) monthlyDataMap[m].revenue += parseValue(l.value);
        });
        const monthlyData = Object.values(monthlyDataMap).sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

        const stateCount: Record<string, number> = {};
        activeLeads.forEach(l => { const s = getStateFromPhone(l.whatsapp); stateCount[s] = (stateCount[s] || 0) + 1; });
        const regionalData = Object.entries(stateCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

        const dailyData = (() => {
            if (!dateRange?.from) return [];
            const daysInterval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to || dateRange.from });
            return (daysInterval.length > 90 ? daysInterval.filter((_, i) => i % 3 === 0) : daysInterval).map(d => ({
                day: format(d, 'dd/MM'),
                leads: activeLeads.filter(l => {
                    if (!l.createdAt) return false;
                    const lDate = subHours(new Date(l.createdAt), 3);
                    return format(lDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                }).length
            }));
        })();

        const funnelData = columns.map(col => ({
            name: col.title,
            value: filtered.filter(l => l.columnId === col.id).length,
            fill: PIPELINE_COLORS[columns.indexOf(col) % PIPELINE_COLORS.length]
        })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

        // Intelligence
        const analytics = processAnalyticsData(activeLeads);
        const staleAlerts = getStaleAlerts(activeLeads, columns, isLeadWon, isLeadLost);
        const funnel = getFunnelData(activeLeads, columns);
        const velocity = getVelocityMetrics(activeLeads, columns, isLeadWon, isLeadLost);
        const followUp = getFollowUpMetrics(activeLeads, isLeadWon, isLeadLost);
        const health = getHealthScore(staleAlerts, followUp, velocity, totalLeadsCount, wonLeadsList.length);
        const advanced = calculateAdvancedInsights(activeLeads, columns, initialSales || []);

        // UTM Stats
        const utmStatsMap = activeLeads.reduce((acc, lead) => {
            if (lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmTerm) {
                const key = `${lead.utmSource || 'N/A'}|${lead.utmMedium || 'N/A'}|${lead.utmCampaign || 'N/A'}|${lead.utmTerm || 'N/A'}`;
                if (!acc[key]) {
                    acc[key] = {
                        name: key,
                        source: lead.utmSource || '-',
                        medium: lead.utmMedium || '-',
                        campaign: lead.utmCampaign || '-',
                        term: lead.utmTerm || '-',
                        size: 0
                    };
                }
                acc[key].size++;
            }
            return acc;
        }, {} as Record<string, { name: string, source: string, medium: string, campaign: string, term: string, size: number }>);
        const utmTableData = Object.values(utmStatsMap).sort((a, b) => b.size - a.size).slice(0, 30);

        // Time of Day Analysis
        const timeOfDayData = [
            { name: 'Manhã', value: 0, fill: '#f59e0b' },
            { name: 'Tarde', value: 0, fill: '#0ea5e9' },
            { name: 'Noite', value: 0, fill: '#6366f1' },
        ];

        activeLeads.forEach(lead => {
            if (!lead.createdAt) return;
            const date = new Date(lead.createdAt);
            // Brasília is UTC-3. If lead arrives at 00:00 UTC, it's 21:00 BRT.
            const localHours = (date.getUTCHours() - 3 + 24) % 24;
            if (localHours >= 6 && localHours < 12) timeOfDayData[0].value += 1;
            else if (localHours >= 12 && localHours < 18) timeOfDayData[1].value += 1;
            else timeOfDayData[2].value += 1; // 18h to 06h (Noite/Madrugada)
        });

        // Relationship Table: Keyword vs Page
        const termPageRelation = activeLeads.reduce((acc, lead) => {
            if (lead.utmTerm || lead.pagePath) {
                const term = lead.utmTerm || "Direto";
                let page = lead.pagePath || "Home";
                try {
                    if (page.startsWith('http')) {
                        const url = new URL(page);
                        page = url.pathname === '/' ? 'Home' : url.pathname;
                    }
                } catch { /* ignore */ }
                if (page.length > 1 && page.endsWith('/')) page = page.slice(0, -1);
                if (page === '/') page = 'Home';

                const key = `${term}|${page}`;
                if (!acc[key]) acc[key] = { term, page, leads: 0 };
                acc[key].leads++;
            }
            return acc;
        }, {} as Record<string, { term: string, page: string, leads: number }>);
        const termPageRelationData = Object.values(termPageRelation).sort((a, b) => b.leads - a.leads).slice(0, 20);

        return {
            uniqueOrigins, states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, averageTicket, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData, timeOfDayData, analytics, termPageRelation: termPageRelationData },
            intelligence: { ...staleAlerts, funnel, velocity, followUp, health, advanced },
            utmStats: utmTableData
        };
    }, [initialLeads, columns, initialSales, dateRange, selectedOrigin, selectedState, selectedColumn, selectedUTMSource, selectedUTMTerm, selectedPage]);

    const handleReset = () => {
        setDateRange({ from: subDays(new Date(), 90), to: new Date() });
        setSelectedOrigin('all');
        setSelectedState('all');
        setSelectedColumn(null);
        setSelectedUTMSource(null);
        setSelectedUTMTerm(null);
        setSelectedPage(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
            {/* Custom Gradients Defs */}
            <svg className="h-0 w-0 absolute pointer-events-none invisible" aria-hidden="true">
                <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Toolbar - Floating Glass Style */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl sticky top-4 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                        <DateRangePickerWithPresets date={dateRange} setDate={setDateRange} />
                    </div>
                </div>
                <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                    <SelectTrigger className="w-full md:w-[180px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        {uniqueOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="w-full md:w-[140px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">Todos os Estados</SelectItem>
                        {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>

                {/* Active Filter Badges */}
                <div className="flex flex-wrap gap-2 items-center">
                    {selectedUTMSource && <div onClick={() => setSelectedUTMSource(null)} className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-blue-500/20 transition-colors border border-blue-500/20">Source: {selectedUTMSource} <span className="text-xs">×</span></div>}
                    {selectedUTMTerm && <div onClick={() => setSelectedUTMTerm(null)} className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-amber-500/20 transition-colors border border-amber-500/20 font-mono">Term: {selectedUTMTerm} <span className="text-xs">×</span></div>}
                    {selectedPage && <div onClick={() => setSelectedPage(null)} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">Page: {selectedPage} <span className="text-xs">×</span></div>}
                    {selectedColumn && <div onClick={() => setSelectedColumn(null)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">{selectedColumn} <span className="text-xs">×</span></div>}
                </div>

                {(selectedColumn || selectedOrigin !== "all" || selectedState !== "all" || selectedUTMSource || selectedUTMTerm || selectedPage) && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white">
                        <RotateCcw className="mr-2 h-4 w-4" /> Resetar
                    </Button>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPI label="Receita Fechada" value={formatCurrency(kpis.revenue)} icon={Wallet} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Pipeline Aberto" value={formatCurrency(kpis.pipeline)} icon={Target} color="text-blue-500" iconBg="bg-blue-500/10" />
                <KPI label="Total de Leads" value={kpis.totalLeads} icon={Users} color="text-slate-900 dark:text-white" iconBg="bg-slate-100 dark:bg-white/5" />
                <KPI label="Taxa de Conversão" value={kpis.conversionRate.toFixed(1) + "%"} icon={TrendingUp} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Ticket Médio" value={formatCurrency(kpis.averageTicket)} icon={Gem} color="text-amber-500" iconBg="bg-amber-500/10" />
                <KPI label="Ciclo Médio" value={`${kpis.avgCycle} dias`} icon={Clock} color="text-indigo-500" iconBg="bg-indigo-500/10" />
                <KPI label="Follow-ups" value={kpis.followUpsCount} icon={CalendarClock} color="text-purple-500" iconBg="bg-purple-500/10" />
            </div>

            {/* STATISTICAL INTELLIGENCE V3.5 - RESTORED FOR LEAD CAPTURE */}
            <Card className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-3xl overflow-hidden glass-card">
                <CardHeader className="py-5 px-6 border-b border-white/5 bg-slate-950/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Activity className="h-6 w-6 text-indigo-400 animate-pulse" />
                            <div>
                                <CardTitle className="text-xl font-black text-white uppercase tracking-[0.3em] italic">Statistical Intelligence V3.5</CardTitle>
                                <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Machine Learning Insights & Pipeline Health Analysis</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                            <div className="text-right">
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Health Score</div>
                                <div className={cn("text-2xl font-black italic tabular-nums", 
                                    intelligence.health.score > 70 ? "text-emerald-400" : intelligence.health.score > 40 ? "text-amber-400" : "text-rose-500")}>
                                    {intelligence.health.score}% | {intelligence.health.grade}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/5">
                        {/* 1. Quality Card */}
                        <div className="p-6 space-y-4 group">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Qualidade de Leads
                                </h4>
                                <Badge variant="outline" className="text-[8px] border-emerald-500/20 text-emerald-500 bg-emerald-500/5 uppercase">Predictive</Badge>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white italic">{intelligence.advanced.leadScoreStats.avgScore}</span>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase">Avg Score</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                    <div className="text-[10px] font-black text-emerald-500">{intelligence.advanced.leadScoreStats.conversionsByGrade['A']}%</div>
                                    <div className="text-[7px] font-bold text-slate-500 uppercase">Conv. Grade A</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                    <div className="text-[10px] font-black text-rose-500">{intelligence.advanced.leadScoreStats.conversionsByGrade['F']}%</div>
                                    <div className="text-[7px] font-bold text-slate-500 uppercase">Conv. Grade F</div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Stagnation Card */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Timer className="w-3.5 h-3.5 text-rose-400" /> Risco de Estagnação
                                </h4>
                                <Badge variant="outline" className="text-[8px] border-rose-500/20 text-rose-500 bg-rose-500/5 uppercase">Anomaly</Badge>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-rose-500 italic">{intelligence.advanced.stagnationMetrics.highRiskLeads}</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">Leads em Risco</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">Ciclo médio de {intelligence.advanced.stagnationMetrics.averageDaysToWin} dias. Desvio de {intelligence.advanced.stagnationMetrics.stdDevDaysToWin.toFixed(1)}d indica processo previsível.</p>
                        </div>

                        {/* 3. Hygiene Card */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Higiene de Pipeline
                                </h4>
                                <Badge variant="outline" className="text-[8px] border-amber-500/20 text-amber-500 bg-amber-500/5 uppercase">Compliance</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                                    <span className="text-xs font-black text-rose-500">{intelligence.critical.length}</span>
                                    <span className="text-[7px] font-bold text-rose-500/60">+15D</span>
                                </div>
                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                    <span className="text-xs font-black text-amber-500">{intelligence.warning.length}</span>
                                    <span className="text-[7px] font-bold text-amber-500/60">7-15D</span>
                                </div>
                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                    <span className="text-xs font-black text-emerald-400">{intelligence.totalOpen - intelligence.critical.length - intelligence.warning.length}</span>
                                    <span className="text-[7px] font-bold text-emerald-500/60">OK</span>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500">Compliance Follow-up: <span className="text-white font-bold">{intelligence.followUp.complianceRate}%</span></div>
                        </div>

                        {/* 4. Attribution/Mix Card */}
                        <div className="p-6 space-y-4 bg-white/[0.02]">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" /> {initialSales?.length > 0 ? 'Concentração ROI' : 'Mix de Origens'}
                                </h4>
                                <Badge variant="outline" className="text-[8px] border-amber-500/20 text-amber-500 bg-amber-500/5 uppercase">Marketing</Badge>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-amber-500 italic">
                                    {initialSales?.length > 0 ? `${(intelligence.advanced.attributionMetrics.roiBySource[0]?.efficiencyScore || 0).toFixed(1)}x` : uniqueOrigins.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">{initialSales?.length > 0 ? "Top Source ROI" : "Fontes Ativas"}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">
                                {initialSales?.length > 0 
                                    ? `Pareto: ${intelligence.advanced.attributionMetrics.paretoSummary.topSourceCount} origens geram ${intelligence.advanced.attributionMetrics.paretoSummary.topRevenuePercentage.toFixed(0)}% da receita.`
                                    : `Concentração: ${uniqueOrigins.length} fontes captando. Top fonte representa ${Math.round((charts.analytics.sourceData[0]?.value / kpis.totalLeads) * 100 || 0)}% do volume.`
                                }
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ===== MILESTONE KEYWORD WINNERS (GRANULAR ATTRIBUTION) ===== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {intelligence.advanced.attributionMetrics.milestoneKeywordPerformance.map((milestone, idx) => (
                    <Card key={idx} className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-3xl overflow-hidden glass-card">
                        <CardHeader className="py-4 px-6 border-b border-white/5 bg-slate-950/40">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black text-white flex items-center gap-3 uppercase tracking-widest italic">
                                        <TrendingUp className="h-4 w-4 text-emerald-400" /> Vencedores: {milestone.stageName}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Keywords que mais convertem para este marco</CardDescription>
                                </div>
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-black italic">TOP CONV</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {milestone.keywords.map((kw, kidx) => (
                                    <div key={kidx} className="flex items-center justify-between py-3 px-6 hover:bg-white/[0.02] transition-colors group">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-white uppercase italic group-hover:text-emerald-400 transition-colors truncate max-w-[200px]">
                                                {kw.name}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Termo da Campanha</span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-white italic tabular-nums">{kw.count}</span>
                                                <span className="text-[11px] font-bold text-slate-500 uppercase">Leads</span>
                                            </div>
                                            <div className="h-8 w-[1px] bg-white/5" />
                                            <div className="flex flex-col items-end min-w-[60px]">
                                                <span className="text-sm font-black text-emerald-400 italic tabular-nums">{kw.rate.toFixed(1)}%</span>
                                                <span className="text-[11px] font-bold text-slate-500 uppercase underline decoration-emerald-500/30">Taxa Cnv</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ===== TRAFFIC PERFORMANCE & ROI INTEL (CONDITIONAL FOR LAUNCH DASHBOARD) ===== */}
            {initialSales?.length > 0 && (
                <Card className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-3xl overflow-hidden glass-card animate-in slide-in-from-top-4 duration-700">
                    <CardHeader className="py-5 px-6 border-b border-white/5 bg-slate-950/40">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-[0.2em] italic">
                                    <Activity className="h-5 w-5 text-indigo-400 animate-pulse" /> Traffic Performance & ROI Intel
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Matriz de Conversão e Atribuição de Receita por Canal</CardDescription>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-500 uppercase px-2">Custo Médio por Lead (BRL)</span>
                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-xs text-slate-400">R$</span>
                                        <Input type="number" value={cpaValue} onChange={(e) => setCpaValue(Number(e.target.value))} className="h-7 w-16 bg-transparent border-none p-0 text-white font-black text-sm focus-visible:ring-0" />
                                    </div>
                                </div>
                                <div className="h-8 w-[1px] bg-white/10" />
                                <div className="flex flex-col items-center justify-center px-4">
                                    <span className="text-xs font-black text-indigo-400 uppercase">Simulador de ROI</span>
                                    <span className="text-xl font-black text-white italic tabular-nums">{kpis.revenue > 0 ? ((kpis.revenue / (kpis.totalLeads * cpaValue)).toFixed(1)) : '0.0'}x</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                            <div className="lg:col-span-7 p-6 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-indigo-400" /> Funil de Conversão por Origem</h4>
                                    <Badge variant="outline" className="text-[8px] bg-white/5 text-slate-500 border-white/10 uppercase">Top Canais</Badge>
                                </div>
                                <div className="space-y-3">
                                    {intelligence.advanced.attributionMetrics.roiBySource.slice(0, 5).map((src, i) => (
                                        <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 flex items-center gap-4 group hover:bg-white/[0.08] transition-all">
                                            <div className="w-10 h-10 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center text-indigo-400 font-black text-xs">
                                                {src.conversionRate > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Users className="w-5 h-5 opacity-40" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[11px] font-black text-white uppercase tracking-tighter">{src.name}</span>
                                                    <span className="text-[10px] font-bold text-indigo-400">{src.leads} Leads → {src.sales} Vendas</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-950/50 rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full transition-all duration-1000", src.conversionRate > 0 ? "bg-emerald-500" : "bg-indigo-500/40")} style={{ width: `${Math.max(5, src.conversionRate)}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-right min-w-[80px]">
                                                <div className="text-xs font-black text-white">{src.conversionRate.toFixed(1)}%</div>
                                                <div className="text-[8px] font-bold text-slate-500 uppercase">Conv. Rate</div>
                                            </div>
                                            <div className="text-right min-w-[100px] border-l border-white/10 pl-4">
                                                <div className="text-sm font-black text-emerald-400">{formatCurrency(src.revenue)}</div>
                                                <div className="text-[8px] font-bold text-slate-500 uppercase">Receita</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:col-span-5 p-6 bg-slate-950/20">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Zap className="w-3.5 h-3.5 text-amber-400" /> Eficiência de Termos (Keyword ROI)</h4>
                                        <div className="space-y-2">
                                            {intelligence.advanced.attributionMetrics.roiByTerm.slice(0, 4).map((term, i) => (
                                                <div key={i} className="flex items-center justify-between text-[11px] py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                                                    <span className="font-mono text-slate-400 truncate max-w-[150px] italic">{term.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-black text-white">{term.sales} Vendas</span>
                                                        <span className="text-emerald-400 font-black tabular-nums">{formatCurrency(term.revenue)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-indigo-600/10 rounded-2xl p-4 border border-indigo-500/20 relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:rotate-12 transition-transform"><BrainCircuit className="w-24 h-24" /></div>
                                        <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Recomendação de Tráfego</h5>
                                        <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                                            {intelligence.advanced.attributionMetrics.paretoSummary.isConcentrated ? 
                                                `Seu tráfego está concentrado em ${intelligence.advanced.attributionMetrics.paretoSummary.topSourceCount} origens que geram ${intelligence.advanced.attributionMetrics.paretoSummary.topRevenuePercentage.toFixed(0)}% da receita.` :
                                                `Conversão equilibrada entre os canais. A fonte "${intelligence.advanced.attributionMetrics.roiBySource[0]?.name}" apresenta a melhor eficiência financeira.`
                                            }
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase cursor-pointer hover:underline">Explorar Detalhamento <ArrowRight className="w-3 h-3" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* CHARTS GRID - ROW 1: Volume & Behavioral */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Volume de Leads Diários */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400"><CalendarClock className="w-4 h-4 text-purple-500" /> Volume de Leads Diários</CardTitle></CardHeader>
                    <CardContent className="h-[300px] pt-6 pb-2 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={charts.dailyData}>
                                <defs><linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={isDark ? 0.4 : 0.6} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis dataKey="day" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: isDark ? '#fff' : '#0f172a', fontSize: '13px' }} itemStyle={{ color: '#a855f7', fontWeight: 'bold' }} />
                                <Area type="monotone" dataKey="leads" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#gradLeads)" animationDuration={2000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Behavioral Peaks (Day/Time) - FIXED LAYOUT */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400"><Clock className="w-4 h-4 text-amber-500" /> Picos Comportamentais</CardTitle></CardHeader>
                    <CardContent className="h-[300px] pt-2 pb-0 px-4">
                        <div className="flex flex-col h-full">
                            <div className="flex-1 min-h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={charts.timeOfDayData}
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={8}
                                            dataKey="value"
                                            animationDuration={1500}
                                            cx="50%"
                                            cy="45%"
                                        >
                                            {charts.timeOfDayData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '12px', fontSize: '13px' }}
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            align="center"
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '20px' }} 
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="pb-4 text-center">
                                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">
                                    Pico: {((Math.max(...charts.timeOfDayData.map(d => d.value)) / kpis.totalLeads) * 100 || 0).toFixed(0)}% no período 
                                    <span className="text-emerald-500 ml-1 italic">{[...charts.timeOfDayData].sort((a,b) => b.value - a.value)[0]?.name}</span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS GRID - ROW 2: Adwords (Full Width) */}
            <div className="mb-6">
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400"><Zap className="w-4 h-4 text-amber-500" /> Performance por Termos (Adwords)</CardTitle></CardHeader>
                    <CardContent className="h-[350px] pt-8 pb-4 px-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.analytics?.termData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis dataKey="name" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + '...' : v} />
                                <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.1)' }} contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: isDark ? '#fff' : '#0f172a', fontSize: '13px' }} />
                                <Bar dataKey="leads" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={40} onClick={(data) => { if (data && data.name) setSelectedUTMTerm(data.name === selectedUTMTerm ? null : data.name) }}>
                                    {(charts.analytics?.termData || []).map((entry: any, index: number) => (
                                        <Cell key={index} fill={entry.name === selectedUTMTerm ? (isDark ? '#ffffff' : '#4f46e5') : '#f59e0b'} fillOpacity={isDark ? 0.3 : 0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Relationship Table: Keywords vs Pages */}
            <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden group">
                <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                        <div><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400"><BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Relacionamento: Keywords vs Páginas</CardTitle><CardDescription className="text-xs text-slate-500 font-bold uppercase tracking-tight mt-1">Quais termos levam a quais páginas e qual a volumetria?</CardDescription></div>
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">Top 20 Relações</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950/50 p-3 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5"><div className="col-span-6 pl-4 font-mono">UTM Term (Palavra-chave)</div><div className="col-span-4">Página (Slug)</div><div className="col-span-2 text-right pr-4 italic">Leads</div></div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar bg-white dark:bg-transparent">
                        {(charts.termPageRelation || []).map((rel: any, i: number) => (
                            <div key={i} className="grid grid-cols-12 p-3 text-[11px] hover:bg-slate-50 dark:hover:bg-white/5 transition-all group/row">
                                <div className="col-span-6 pl-2 font-black text-slate-700 dark:text-slate-200 truncate pr-2 border-l-2 border-purple-500/30 group-hover/row:border-purple-500 transition-colors uppercase tracking-tight">{rel.term}</div>
                                <div className="col-span-4 text-slate-500 dark:text-slate-400 truncate text-[11px] italic">{rel.page}</div>
                                <div className="col-span-2 text-right pr-4 font-black text-purple-600 dark:text-purple-400 text-xl tabular-nums">{rel.leads}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Performance de UTMs Table */}
            {utmStats.length > 0 && (
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 py-4"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400"><Link2 className="w-4 h-4 text-blue-600 dark:text-blue-500" /> Detalhamento de Campanhas (UTMs)</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-hidden bg-white dark:bg-transparent">
                            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950/50 p-3 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5"><div className="col-span-2">Source</div><div className="col-span-2">Medium</div><div className="col-span-4">Campaign</div><div className="col-span-3">Term (Keyword)</div><div className="col-span-1 text-right pr-2">Leads</div></div>
                            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {utmStats.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 p-3 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <div className="col-span-2 truncate pr-2 opacity-60 group-hover:opacity-100">{item.source}</div>
                                        <div className="col-span-2 truncate pr-2 text-slate-400 dark:text-slate-500 text-[11px]">{item.medium}</div>
                                        <div className="col-span-4 truncate pr-2 font-bold text-blue-600 dark:text-blue-400/80 group-hover:text-blue-500">{item.campaign}</div>
                                        <div className="col-span-3 truncate pr-2 text-slate-500 dark:text-slate-400 font-mono italic text-[11px]">{item.term}</div>
                                        <div className="col-span-1 text-right font-black pr-2 text-slate-900 dark:text-white">{item.size}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bottom Regions/Pipeline Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-10 border-t border-slate-200 dark:border-white/5">
                <Card className="bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <CardHeader className="py-2 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Regional (Ativos)</CardTitle></CardHeader>
                    <CardContent className="h-[200px] pt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.regionalData} layout="vertical"><YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} width={25} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', color: isDark ? '#fff' : '#0f172a', fontSize: '12px' }} /><Bar dataKey="value" fill={isDark ? "#475569" : "#94a3b8"} radius={[0, 4, 4, 0]} barSize={8} /></BarChart></ResponsiveContainer></CardContent>
                </Card>
                <Card className="bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <CardHeader className="py-2 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pipeline (Volume)</CardTitle></CardHeader>
                    <CardContent className="h-[200px] pt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.funnelData} layout="vertical"><YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} width={100} tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) : v} axisLine={false} tickLine={false} /><Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8} fill={isDark ? "#475569" : "#94a3b8"} /></BarChart></ResponsiveContainer></CardContent>
                </Card>
            </div>
        </div>
    );
}
