"use client";

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
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
import { processAnalyticsData, calculateConversionBySource, getStaleAlerts, getFunnelData, getVelocityMetrics, getFollowUpMetrics, getHealthScore } from "@/lib/analytics-helper";
import { cn } from "@/lib/utils";

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
            if (selectedOrigin !== "all" && (lead.campaignSource || "Direto") !== selectedOrigin) return false;
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

        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => l.campaignSource || "Direto").filter(Boolean))).sort();
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
        })).filter(d => d.value > 0);

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

        return {
            uniqueOrigins, states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, averageTicket, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData },
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
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-900 rounded-md border border-slate-800">
                        <DateRangePickerWithPresets date={dateRange} setDate={setDateRange} />
                    </div>
                </div>
                <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                    <SelectTrigger className="w-full md:w-[180px] bg-slate-900 border-slate-800 text-slate-100">
                        <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        {uniqueOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="w-full md:w-[140px] bg-slate-900 border-slate-800 text-slate-100">
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
                        <div onClick={() => setSelectedColumn(null)} className="flex items-center gap-1.5 bg-slate-800 text-slate-300 px-2 py-1 rounded-md text-[10px] cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700">
                            {selectedColumn} <span className="text-xs">×</span>
                        </div>
                    )}
                </div>

                {(selectedColumn || selectedOrigin !== "all" || selectedState !== "all" || selectedUTMSource || selectedUTMTerm || selectedPage) && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-slate-400 hover:text-white">
                        <RotateCcw className="mr-2 h-4 w-4" /> Resetar
                    </Button>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPI label="Receita Fechada" value={formatCurrency(kpis.revenue)} icon={Wallet} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Pipeline Aberto" value={formatCurrency(kpis.pipeline)} icon={Target} color="text-blue-500" iconBg="bg-blue-500/10" />
                <KPI label="Total de Leads" value={kpis.totalLeads} icon={Users} color="text-slate-900 dark:text-white" />
                <KPI label="Taxa de Conversão" value={kpis.conversionRate.toFixed(1) + "%"} icon={TrendingUp} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Ticket Médio" value={formatCurrency(kpis.averageTicket)} icon={Gem} color="text-amber-500" iconBg="bg-amber-500/10" />
                <KPI label="Ciclo Médio" value={`${kpis.avgCycle} dias`} icon={Clock} color="text-indigo-500" iconBg="bg-indigo-500/10" />
                <KPI label="Follow-ups" value={kpis.followUpsCount} icon={CalendarClock} color="text-purple-500" iconBg="bg-purple-500/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Leads Chart */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg border-l-4 border-l-purple-500">
                    <CardHeader className="py-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Volume de Leads Diários</CardTitle></CardHeader>
                    <CardContent className="h-[200px] pb-6 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="leads" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top UTM Terms (Keywords) - NOW VERTICAL AND PROMINENT */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg border-l-4 border-l-amber-500">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" /> Top UTM Terms (Keywords)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] pb-6 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.termData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 12 ? v.substring(0, 10) + '...' : v} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }} />
                                <Bar dataKey="leads" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={25} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedUTMTerm(data.name === selectedUTMTerm ? null : data.name) }}
                                >
                                    {newMetrics.termData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedUTMTerm ? '#ffffff' : '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ===== MARKETING INTELLIGENCE (NEW SECTION) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top UTM Sources */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Top UTM Sources</CardTitle>
                        <MousePointerClick className="w-3 h-3 text-blue-500" />
                    </CardHeader>
                    <CardContent className="h-[220px] pb-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.sourceData} layout="vertical" margin={{ left: -10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 9 }} width={80} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedUTMSource(data.name === selectedUTMSource ? null : data.name) }}
                                >
                                    {newMetrics.sourceData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedUTMSource ? '#ffffff' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Landing Pages */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Páginas de Entrada</CardTitle>
                        <FileText className="w-3 h-3 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="h-[220px] pb-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newMetrics.pageData} layout="vertical" margin={{ left: -10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 9 }} width={100} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + '...' : v} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }} />
                                <Bar dataKey="leads" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} className="cursor-pointer"
                                    onClick={(data) => { if (data && data.name) setSelectedPage(data.name === selectedPage ? null : data.name) }}
                                >
                                    {newMetrics.pageData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedPage ? '#ffffff' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Keyword vs Page Relationship */}
            <Card className="bg-slate-950 border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="py-3 border-b border-slate-800">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-purple-400" />
                        Relacionamento: Keywords vs Páginas
                    </CardTitle>
                    <CardDescription className="text-[10px]">Quais termos levam a quais páginas e qual a volumetria? (Top 20 relações)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-12 bg-slate-900/50 p-2 text-[10px] font-bold text-slate-500 uppercase">
                        <div className="col-span-6 pl-4 font-mono">UTM Term (Palavra-chave)</div>
                        <div className="col-span-4">Página (Slug)</div>
                        <div className="col-span-2 text-right pr-4 italic">Leads</div>
                    </div>
                    <div className="divide-y divide-slate-800 max-h-[250px] overflow-y-auto custom-scrollbar">
                        {newMetrics.termPageRelation.map((rel, i) => (
                            <div key={i} className="grid grid-cols-12 p-3 text-[11px] hover:bg-slate-900 transition-colors">
                                <div className="col-span-6 pl-2 font-medium text-slate-200 truncate pr-2 border-l-2 border-slate-700">{rel.term}</div>
                                <div className="col-span-4 text-slate-400 truncate">{rel.page}</div>
                                <div className="col-span-2 text-right pr-4 font-bold text-purple-400">{rel.leads}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Performance de UTMs Table */}
            {utmStats.length > 0 && (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-blue-500" />
                            Detalhamento de Campanhas (UTMs)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950 p-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <div className="col-span-2">Source</div>
                                <div className="col-span-2">Medium</div>
                                <div className="col-span-4">Campaign</div>
                                <div className="col-span-3">Term (Keyword)</div>
                                <div className="col-span-1 text-right pr-2">Leads</div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                                {utmStats.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 p-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <div className="col-span-2 truncate pr-2">{item.source}</div>
                                        <div className="col-span-2 truncate pr-2 text-slate-400">{item.medium}</div>
                                        <div className="col-span-4 truncate pr-2 font-medium text-blue-600 dark:text-blue-400">{item.campaign}</div>
                                        <div className="col-span-3 truncate pr-2 text-slate-500 font-mono italic">{item.term}</div>
                                        <div className="col-span-1 text-right font-bold pr-2">{item.size}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sales Intelligence v3 (Lower Priority Now) */}
            <Card className="bg-slate-950/50 border-slate-800 shadow-xl overflow-hidden opacity-90">
                <CardHeader className="pb-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrainCircuit className="h-4 w-4 text-slate-400" />
                            <div>
                                <CardTitle className="text-slate-300 text-sm">Saúde do Pipeline</CardTitle>
                                <CardDescription className="text-[10px] text-slate-600">
                                    Insights acionáveis baseados em dados reais
                                </CardDescription>
                            </div>
                        </div>
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full", gradeBg[intelligence.health.grade])}>
                            <Activity className={cn("h-3 w-3", gradeColors[intelligence.health.grade])} />
                            <span className={cn("text-sm font-bold", gradeColors[intelligence.health.grade])}>
                                {intelligence.health.score}
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                        {/* Stale Alerts */}
                        <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leads Parados</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-red-500/10 rounded p-1">
                                    <div className="text-sm font-bold text-red-400">{intelligence.staleAlerts.critical.length}</div>
                                    <div className="text-[8px] text-red-400/70">+15d</div>
                                </div>
                                <div className="bg-amber-500/10 rounded p-1">
                                    <div className="text-sm font-bold text-amber-400">{intelligence.staleAlerts.warning.length}</div>
                                    <div className="text-[8px] text-amber-400/70">7-15d</div>
                                </div>
                                <div className="bg-emerald-500/10 rounded p-1">
                                    <div className="text-sm font-bold text-emerald-400">{intelligence.staleAlerts.healthy}</div>
                                    <div className="text-[8px] text-emerald-400/70">Ok</div>
                                </div>
                            </div>
                        </div>

                        {/* Velocity */}
                        <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <Zap className="h-3 w-3 text-blue-500" />
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Velocidade (Médias)</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-800/50 rounded p-2 text-center">
                                    <div className="text-sm font-bold text-blue-400">{intelligence.velocity.avgDaysToClose || '—'}d</div>
                                    <div className="text-[8px] text-slate-600">p/ fechar</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2 text-center">
                                    <div className="text-sm font-bold text-rose-400">{intelligence.velocity.avgDaysToLose || '—'}d</div>
                                    <div className="text-[8px] text-slate-600">p/ perder</div>
                                </div>
                            </div>
                        </div>

                        {/* Follow-up */}
                        <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <Bell className="h-3 w-3 text-purple-500" />
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Follow-ups</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className={cn("rounded p-2 text-center", intelligence.followUp.overdueLeads.length > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
                                    <div className={cn("text-sm font-bold", intelligence.followUp.overdueLeads.length > 0 ? "text-red-400" : "text-emerald-400")}>
                                        {intelligence.followUp.overdueLeads.length}
                                    </div>
                                    <div className="text-[8px] text-slate-600">vencidos</div>
                                </div>
                                <div className="bg-slate-800/50 rounded p-2 text-center">
                                    <div className="text-sm font-bold text-purple-400">{intelligence.followUp.complianceRate}%</div>
                                    <div className="text-[8px] text-slate-600">em dia</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legacy Section at Bottom */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-80 border-t border-slate-800 pt-10">
                <Card className="bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="py-2"><CardTitle className="text-[10px] font-bold text-slate-500">Regional (Ativos)</CardTitle></CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.regionalData} layout="vertical">
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 9 }} width={25} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }} />
                                <Bar dataKey="value" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="py-2"><CardTitle className="text-[10px] font-bold text-slate-500">Pipeline (Volume)</CardTitle></CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.funnelData} layout="vertical">
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 9 }} width={100} tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) : v} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={10} fill="#94a3b8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
