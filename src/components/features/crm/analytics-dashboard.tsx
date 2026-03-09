"use client";

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    AreaChart, Area, PieChart, Pie, Legend
} from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, Clock, CalendarClock,
    RotateCcw, FileText, MousePointerClick, Gem, BrainCircuit, Link2,
    AlertTriangle, Activity, Zap, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI } from "./analytics-components";
import { getLeadSource } from "@/lib/leads-helper";
import { processAnalyticsData, calculateConversionBySource, getStaleAlerts, getFunnelData, getVelocityMetrics, getFollowUpMetrics, getHealthScore } from "@/lib/analytics-helper";
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
}

export function AnalyticsDashboard({ initialLeads, columns }: AnalyticsDashboardProps) {
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

    const {
        kpis, charts, uniqueOrigins, states, newMetrics,
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

            // Cross-filters
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
        const wonLeads = activeLeads.filter(isLeadWon);
        const openLeads = activeLeads.filter(l => !isLeadWon(l) && !isLeadLost(l));

        const revenue = wonLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const pipeline = openLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const conversionRate = totalLeadsCount ? (wonLeads.length / totalLeadsCount) * 100 : 0;
        const averageTicket = wonLeads.length ? revenue / wonLeads.length : 0;
        const avgCycle = wonLeads.length
            ? Math.round(wonLeads.reduce((acc, l) => acc + differenceInDays(new Date(), l.createdAt ? new Date(l.createdAt) : new Date()), 0) / wonLeads.length)
            : 0;
        const followUpsCount = activeLeads.filter(l => l.followUpDate && startOfDay(new Date(l.followUpDate)) >= startOfDay(new Date())).length;

        // Charts
        const monthlyDataMap: Record<string, { month: string, leads: number, revenue: number, sortDate: Date }> = {};
        activeLeads.forEach(l => {
            if (!l.createdAt) return;
            const date = new Date(l.createdAt);
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
                leads: activeLeads.filter(l => l.createdAt && format(new Date(l.createdAt), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length
            }));
        })();

        const funnelData = columns.map(col => ({
            name: col.title,
            value: filtered.filter(l => l.columnId === col.id).length,
            fill: PIPELINE_COLORS[columns.indexOf(col) % PIPELINE_COLORS.length]
        })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

        // New Metrics
        const processedNewMetrics = processAnalyticsData(activeLeads);
        const conversionData = calculateConversionBySource(activeLeads, isLeadWon);

        // === INTELLIGENCE v3 ===
        const staleAlerts = getStaleAlerts(activeLeads, columns, isLeadWon, isLeadLost);
        const funnel = getFunnelData(activeLeads, columns);
        const velocity = getVelocityMetrics(activeLeads, columns, isLeadWon, isLeadLost);
        const followUp = getFollowUpMetrics(activeLeads, isLeadWon, isLeadLost);
        const health = getHealthScore(staleAlerts, followUp, velocity, totalLeadsCount, wonLeads.length);

        // UTM
        const utmStatsMap = activeLeads.reduce((acc, lead) => {
            if (lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmTerm) {
                // Key MUST include term and campaign for accuracy
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

        // Time of Day Analysis (Fuso +3)
        const timeOfDayData = [
            { name: 'Manhã (06h-12h)', value: 0, fill: '#f59e0b' },
            { name: 'Tarde (12h-18h)', value: 0, fill: '#0ea5e9' },
            { name: 'Noite (18h-06h)', value: 0, fill: '#6366f1' },
        ];

        activeLeads.forEach(lead => {
            if (!lead.createdAt) return;
            const date = new Date(lead.createdAt);
            const utcHours = date.getUTCHours();
            // Offset for Fuso +3 as requested
            const localHours = (utcHours + 3) % 24;

            if (localHours >= 6 && localHours < 12) {
                timeOfDayData[0].value += 1;
            } else if (localHours >= 12 && localHours < 18) {
                timeOfDayData[1].value += 1;
            } else {
                timeOfDayData[2].value += 1;
            }
        });

        // Sort descending
        timeOfDayData.sort((a, b) => b.value - a.value);

        return {
            uniqueOrigins, states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, averageTicket, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData, timeOfDayData },
            newMetrics: { ...processedNewMetrics, conversionData },
            intelligence: { staleAlerts, funnel, velocity, followUp, health },
            utmStats: utmTableData
        };
    }, [initialLeads, columns, dateRange, selectedOrigin, selectedState, selectedColumn, selectedUTMSource, selectedUTMTerm, selectedPage]);

    const handleReset = () => {
        setDateRange({ from: subDays(new Date(), 90), to: new Date() });
        setSelectedOrigin('all');
        setSelectedState('all');
        setSelectedColumn(null);
        setSelectedUTMSource(null);
        setSelectedUTMTerm(null);
        setSelectedPage(null);
    };

    const gradeColors: Record<string, string> = { A: 'text-emerald-400', B: 'text-green-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400' };
    const gradeBg: Record<string, string> = { A: 'bg-emerald-500/20', B: 'bg-green-500/20', C: 'bg-amber-500/20', D: 'bg-orange-500/20', F: 'bg-red-500/20' };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
            {/* Custom Gradients Defs */}
            <svg className="h-0 w-0 absolute pointer-events-none invisible" aria-hidden="true">
                <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTerms" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                    {selectedUTMSource && (
                        <div onClick={() => setSelectedUTMSource(null)} className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                            Source: {selectedUTMSource} <span className="text-xs">×</span>
                        </div>
                    )}
                    {selectedUTMTerm && (
                        <div onClick={() => setSelectedUTMTerm(null)} className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-amber-500/20 transition-colors border border-amber-500/20 font-mono">
                            Term: {selectedUTMTerm} <span className="text-xs">×</span>
                        </div>
                    )}
                    {selectedPage && (
                        <div onClick={() => setSelectedPage(null)} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                            Page: {selectedPage} <span className="text-xs">×</span>
                        </div>
                    )}
                    {selectedColumn && (
                        <div onClick={() => setSelectedColumn(null)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                            {selectedColumn} <span className="text-xs">×</span>
                        </div>
                    )}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Leads Chart - UPGRADED TO AREA */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <CalendarClock className="w-3.5 h-3.5 text-purple-500" /> Volume de Leads Diários
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[220px] pt-6 pb-2 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={charts.dailyData}>
                                <defs>
                                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={isDark ? 0.4 : 0.6} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis dataKey="day" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        color: isDark ? '#fff' : '#0f172a'
                                    }}
                                    itemStyle={{ color: '#a855f7', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="leads" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#gradLeads)" animationDuration={2000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top UTM Terms (Keywords) - NOW VERTICAL AND PROMINENT */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Zap className="w-3.5 h-3.5 text-amber-500" /> Top UTM Terms (Keywords)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[220px] pt-6 pb-2 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.termData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis dataKey="name" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 12 ? v.substring(0, 10) + '...' : v} />
                                <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.1)' }}
                                    contentStyle={{
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        color: isDark ? '#fff' : '#0f172a',
                                        fontSize: '10px'
                                    }}
                                />
                                <Bar dataKey="leads" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={25} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedUTMTerm(data.name === selectedUTMTerm ? null : data.name) }}
                                >
                                    {newMetrics.termData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedUTMTerm ? (isDark ? '#ffffff' : '#4f46e5') : '#f59e0b'} fillOpacity={isDark ? 0.3 : 0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Time of Day Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl h-[350px]">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Horário de Entrada (Fuso +3)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px] pt-6 pb-2 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={charts.timeOfDayData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {charts.timeOfDayData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        color: isDark ? '#fff' : '#0f172a'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', paddingLeft: '20px' }} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ===== MARKETING INTELLIGENCE (NEW SECTION) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top UTM Sources */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-slate-100 dark:border-white/5">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Top UTM Sources</CardTitle>
                        <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
                    </CardHeader>
                    <CardContent className="h-[220px] pt-4 pb-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.sourceData} layout="vertical" margin={{ left: -10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }} width={80} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                                    contentStyle={{
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        color: isDark ? '#fff' : '#0f172a',
                                        fontSize: '10px'
                                    }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={12} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedUTMSource(data.name === selectedUTMSource ? null : data.name) }}
                                >
                                    {newMetrics.sourceData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedUTMSource ? (isDark ? '#ffffff' : '#4f46e5') : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Landing Pages */}
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-slate-100 dark:border-white/5">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Páginas de Entrada</CardTitle>
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="h-[220px] pt-4 pb-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.pageData} layout="vertical" margin={{ left: -10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }} width={100} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + '...' : v} />
                                <Tooltip
                                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                                    contentStyle={{
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        color: isDark ? '#fff' : '#0f172a',
                                        fontSize: '10px'
                                    }}
                                />
                                <Bar dataKey="leads" fill="#10b981" radius={[0, 6, 6, 0]} barSize={12} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedPage(data.name === selectedPage ? null : data.name) }}
                                >
                                    {newMetrics.pageData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedPage ? (isDark ? '#ffffff' : '#4f46e5') : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Keyword vs Page Relationship */}
            <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden group">
                <CardHeader className="py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                Relacionamento: Keywords vs Páginas
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">Quais termos levam a quais páginas e qual a volumetria?</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">Top 20 Relações</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950/50 p-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                        <div className="col-span-6 pl-4 font-mono">UTM Term (Palavra-chave)</div>
                        <div className="col-span-4">Página (Slug)</div>
                        <div className="col-span-2 text-right pr-4 italic">Leads</div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar bg-white dark:bg-transparent">
                        {newMetrics.termPageRelation.map((rel, i) => (
                            <div key={i} className="grid grid-cols-12 p-3 text-[11px] hover:bg-slate-50 dark:hover:bg-white/5 transition-all group/row">
                                <div className="col-span-6 pl-2 font-black text-slate-700 dark:text-slate-200 truncate pr-2 border-l-2 border-purple-500/30 group-hover/row:border-purple-500 transition-colors uppercase tracking-tight">{rel.term}</div>
                                <div className="col-span-4 text-slate-500 dark:text-slate-400 truncate text-[10px] italic">{rel.page}</div>
                                <div className="col-span-2 text-right pr-4 font-black text-purple-600 dark:text-purple-400 text-lg tabular-nums drop-shadow-[0_0_8px_rgba(168,85,247,0.2)] dark:drop-shadow-[0_0_8px_rgba(168,85,247,0.2)]">{rel.leads}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Performance de UTMs Table */}
            {utmStats.length > 0 && (
                <Card className="bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 py-4">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                            Detalhamento de Campanhas (UTMs)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-hidden bg-white dark:bg-transparent">
                            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950/50 p-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                                <div className="col-span-2">Source</div>
                                <div className="col-span-2">Medium</div>
                                <div className="col-span-4">Campaign</div>
                                <div className="col-span-3">Term (Keyword)</div>
                                <div className="col-span-1 text-right pr-2">Leads</div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {utmStats.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 p-3 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <div className="col-span-2 truncate pr-2 opacity-60 group-hover:opacity-100">{item.source}</div>
                                        <div className="col-span-2 truncate pr-2 text-slate-400 dark:text-slate-500 text-[10px]">{item.medium}</div>
                                        <div className="col-span-4 truncate pr-2 font-bold text-blue-600 dark:text-blue-400/80 group-hover:text-blue-500">{item.campaign}</div>
                                        <div className="col-span-3 truncate pr-2 text-slate-500 dark:text-slate-400 font-mono italic text-[10px]">{item.term}</div>
                                        <div className="col-span-1 text-right font-black pr-2 text-slate-900 dark:text-white">{item.size}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sales Intelligence v3 (Lower Priority Now) */}
            <Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-3xl overflow-hidden glass-card">
                <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-950 rounded-xl border border-white/5 shadow-inner">
                                <BrainCircuit className="h-5 w-5 text-indigo-400 animate-pulse" />
                            </div>
                            <div>
                                <CardTitle className="text-white text-xs font-black uppercase tracking-[0.2em]">Saúde do Pipeline</CardTitle>
                                <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">
                                    Inteligência Artificial & Insights Reais
                                </CardDescription>
                            </div>
                        </div>
                        <div className={cn("flex items-center gap-2 px-4 py-1.5 rounded-2xl shadow-lg border border-white/5", gradeBg[intelligence.health.grade])}>
                            <Activity className={cn("h-4 w-4", gradeColors[intelligence.health.grade])} />
                            <span className={cn("text-lg font-black tracking-tighter", gradeColors[intelligence.health.grade])}>
                                {intelligence.health.score}
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
                        {/* Stale Alerts */}
                        <div className="p-6 space-y-4 hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[.2em]">Leads Parados</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-red-500/10 rounded-xl p-2 border border-red-500/20 shadow-lg">
                                    <div className="text-xl font-black text-red-400 tabular-nums">{intelligence.staleAlerts.critical.length}</div>
                                    <div className="text-[9px] font-black text-red-400/70 uppercase tracking-tighter">+15d</div>
                                </div>
                                <div className="bg-amber-500/10 rounded-xl p-2 border border-amber-500/20 shadow-lg">
                                    <div className="text-xl font-black text-amber-400 tabular-nums">{intelligence.staleAlerts.warning.length}</div>
                                    <div className="text-[9px] font-black text-amber-400/70 uppercase tracking-tighter">7-15d</div>
                                </div>
                                <div className="bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20 shadow-lg">
                                    <div className="text-xl font-black text-emerald-400 tabular-nums">{intelligence.staleAlerts.healthy}</div>
                                    <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-tighter">OK</div>
                                </div>
                            </div>
                        </div>

                        {/* Velocity */}
                        <div className="p-6 space-y-4 hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-blue-500" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[.2em]">Velocidade</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-950/50 rounded-xl p-3 text-center border border-white/5 shadow-inner group-hover:border-blue-500/20 transition-colors">
                                    <div className="text-2xl font-black text-blue-400 tabular-nums">{intelligence.velocity.avgDaysToClose || '—'}d</div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">p/ fechar</div>
                                </div>
                                <div className="bg-slate-950/50 rounded-xl p-3 text-center border border-white/5 shadow-inner group-hover:border-rose-500/20 transition-colors">
                                    <div className="text-2xl font-black text-rose-400 tabular-nums">{intelligence.velocity.avgDaysToLose || '—'}d</div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">p/ perder</div>
                                </div>
                            </div>
                        </div>

                        {/* Follow-up */}
                        <div className="p-6 space-y-4 hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-purple-500" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[.2em]">Follow-ups</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className={cn("rounded-xl p-3 text-center border shadow-lg group-hover:scale-105 transition-transform", intelligence.followUp.overdueLeads.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20")}>
                                    <div className={cn("text-2xl font-black tabular-nums", intelligence.followUp.overdueLeads.length > 0 ? "text-red-400" : "text-emerald-400")}>
                                        {intelligence.followUp.overdueLeads.length}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">vencidos</div>
                                </div>
                                <div className="bg-slate-950/50 rounded-xl p-3 text-center border border-white/5 shadow-inner group-hover:border-purple-500/20 transition-colors">
                                    <div className="text-2xl font-black text-purple-400 tabular-nums">{intelligence.followUp.complianceRate}%</div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">em dia</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legacy Section at Bottom - SUBTLE GLASS STYLE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-10 border-t border-slate-200 dark:border-white/5">
                <Card className="bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <CardHeader className="py-2 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Regional (Ativos)</CardTitle></CardHeader>
                    <CardContent className="h-[200px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.regionalData} layout="vertical">
                                <YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }} width={25} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', color: isDark ? '#fff' : '#0f172a', fontSize: '10px' }} />
                                <Bar dataKey="value" fill={isDark ? "#475569" : "#94a3b8"} radius={[0, 4, 4, 0]} barSize={8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <CardHeader className="py-2 border-b border-slate-100 dark:border-white/5"><CardTitle className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pipeline (Volume)</CardTitle></CardHeader>
                    <CardContent className="h-[200px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.funnelData} layout="vertical">
                                <YAxis dataKey="name" type="category" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }} width={100} tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) : v} axisLine={false} tickLine={false} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8} fill={isDark ? "#475569" : "#94a3b8"} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
