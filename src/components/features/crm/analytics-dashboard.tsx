"use client";

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell,
    PieChart, Pie, Legend, Treemap
} from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, Clock, CalendarClock,
    RotateCcw, Smile, Frown, Flame, FileText, BarChart3, MousePointerClick, Gem, BrainCircuit, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI, InsightStat, ActionTag, PeriodSummary } from "./analytics-components";
import { processAnalyticsData, calculateConversionBySource, analyzeKeywords } from "@/lib/analytics-helper";
import { cn } from "@/lib/utils";

// --- Colors & Helpers ---
const PIPELINE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9"];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

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
    // --- State ---
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 90),
        to: new Date()
    });
    const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
    const [selectedState, setSelectedState] = useState<string>("all");
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

    // --- Identification Functions (Robust) ---
    // Check titles in a case-insensitive way
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

    // --- Data Processing & Metrics ---
    const {
        interactiveLeads,
        kpis,
        charts,
        uniqueOrigins,
        states,
        keywordData,
        newMetrics,
        salesIntelligence,
        utmStats
    } = useMemo(() => {
        // 1. Base Filter (Toolbar)
        const filtered = initialLeads.filter(lead => {
            if (dateRange?.from) {
                const start = startOfDay(dateRange.from);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
                if (!isWithinInterval(createdAt, { start, end })) return false;
            }
            if (selectedOrigin !== "all" && (lead.campaignSource || "Direto") !== selectedOrigin) return false;
            if (selectedState !== "all" && getStateFromPhone(lead.whatsapp) !== selectedState) return false;
            return true;
        });

        // 2. Interactive Filter (Click Selection)
        const activeLeads = filtered.filter(lead => {
            if (selectedColumn && lead.columnId !== columns.find(c => c.title === selectedColumn)?.id) return false;
            if (selectedKeyword) {
                return (lead.notes || "").toLowerCase().includes(selectedKeyword.toLowerCase());
            }
            return true;
        });

        // 3. Metadata Lists
        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => l.campaignSource || "Direto").filter(Boolean))).sort();
        const states = Array.from(new Set(initialLeads.map(l => getStateFromPhone(l.whatsapp)))).sort();

        // 4. KPIs
        const totalLeadsCount = activeLeads.length;
        const wonLeads = activeLeads.filter(isLeadWon);
        const lostLeads = activeLeads.filter(isLeadLost);
        const openLeads = activeLeads.filter(l => !isLeadWon(l) && !isLeadLost(l));

        const revenue = wonLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const pipeline = openLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const conversionRate = totalLeadsCount ? (wonLeads.length / totalLeadsCount) * 100 : 0;
        const averageTicket = wonLeads.length ? revenue / wonLeads.length : 0;

        const avgCycle = wonLeads.length
            ? Math.round(wonLeads.reduce((acc, l) => acc + differenceInDays(new Date(), l.createdAt ? new Date(l.createdAt) : new Date()), 0) / wonLeads.length)
            : 0;

        const followUpsCount = activeLeads.filter(l => l.followUpDate && startOfDay(new Date(l.followUpDate)) >= startOfDay(new Date())).length;

        // 5. Charts
        // Monthly Evolution
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

        // Regional Distribution
        const stateCount: Record<string, number> = {};
        activeLeads.forEach(l => {
            const s = getStateFromPhone(l.whatsapp);
            stateCount[s] = (stateCount[s] || 0) + 1;
        });
        const regionalData = Object.entries(stateCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 8);

        // Daily Heat
        const dailyData = (() => {
            if (!dateRange?.from) return [];
            const daysInterval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to || dateRange.from });
            return (daysInterval.length > 90 ? daysInterval.filter((_, i) => i % 3 === 0) : daysInterval).map(d => ({
                day: format(d, 'dd/MM'),
                leads: activeLeads.filter(l => l.createdAt && format(new Date(l.createdAt), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length
            }));
        })();

        // Pipeline Stages
        const funnelData = columns.map(col => ({
            name: col.title,
            value: filtered.filter(l => l.columnId === col.id).length,
            fill: PIPELINE_COLORS[columns.indexOf(col) % PIPELINE_COLORS.length]
        })).filter(d => d.value > 0);

        // --- NEW METRICS ---
        const processedNewMetrics = processAnalyticsData(activeLeads);
        const conversionData = calculateConversionBySource(activeLeads, isLeadWon);
        const newMetrics = {
            ...processedNewMetrics,
            conversionData
        };

        // --- SALES INTELLIGENCE (KEYWORDS) ---
        const salesIntelligence = analyzeKeywords(activeLeads, isLeadWon, isLeadLost);
        const topKeywords = salesIntelligence.active.slice(0, 5).map(k => ({ keyword: k.word, count: k.count, color: "text-amber-500" }));

        // --- UTM ANALYSIS ---
        // Collect existing UTM data
        const utmStats = activeLeads.reduce((acc, lead) => {
            if (lead.utmSource || lead.utmMedium || lead.utmCampaign) {
                const key = `${lead.utmSource || 'N/A'} / ${lead.utmMedium || 'N/A'}`;
                if (!acc[key]) acc[key] = { name: key, size: 0, campaigns: new Set() };
                acc[key].size++;
                if (lead.utmCampaign) acc[key].campaigns.add(lead.utmCampaign);
            }
            return acc;
        }, {} as Record<string, { name: string, size: number, campaigns: Set<string> }>);

        const utmTreeData = Object.values(utmStats).map(s => ({ ...s, campaigns: Array.from(s.campaigns).join(', ') })).sort((a, b) => b.size - a.size).slice(0, 10);

        return {
            interactiveLeads: activeLeads,
            uniqueOrigins,
            states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, averageTicket, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData },
            keywordData: topKeywords,
            newMetrics,
            salesIntelligence,
            utmStats: utmTreeData
        };
    }, [initialLeads, columns, dateRange, selectedOrigin, selectedState, selectedColumn, selectedKeyword]);

    const handleReset = () => {
        setDateRange({ from: subDays(new Date(), 90), to: new Date() });
        setSelectedOrigin('all');
        setSelectedState('all');
        setSelectedColumn(null);
        setSelectedKeyword(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-4">
            {/* Toolbar Filters */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-900 rounded-md border border-slate-800">
                        <DateRangePickerWithPresets date={dateRange} setDate={setDateRange} />
                    </div>
                </div>

                <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                    <SelectTrigger className="w-full md:w-[180px] bg-slate-900 border-slate-800 text-slate-100 dark:hover:bg-slate-800/50">
                        <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        {uniqueOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="w-full md:w-[140px] bg-slate-900 border-slate-800 text-slate-100 dark:hover:bg-slate-800/50">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">Todos os Estados</SelectItem>
                        {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>

                {(selectedColumn || selectedKeyword || selectedOrigin !== "all" || selectedState !== "all") && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-slate-400 hover:text-white">
                        <RotateCcw className="mr-2 h-4 w-4" /> Resetar Filtros
                    </Button>
                )}
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPI label="Receita Fechada" value={formatCurrency(kpis.revenue)} icon={Wallet} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Pipeline Aberto" value={formatCurrency(kpis.pipeline)} icon={Target} color="text-blue-500" iconBg="bg-blue-500/10" />
                <KPI label="Total de Leads" value={kpis.totalLeads} icon={Users} color="text-slate-900 dark:text-white" />
                <KPI label="Taxa de Conversão" value={kpis.conversionRate.toFixed(1) + "%"} icon={TrendingUp} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Ticket Médio" value={formatCurrency(kpis.averageTicket)} icon={Gem} color="text-amber-500" iconBg="bg-amber-500/10" />
                <KPI label="Ciclo Médio" value={`${kpis.avgCycle} dias`} icon={Clock} color="text-indigo-500" iconBg="bg-indigo-500/10" />
                <KPI label="Follow-ups" value={kpis.followUpsCount} icon={CalendarClock} color="text-purple-500" iconBg="bg-purple-500/10" />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                            Evolução de Vendas
                            <div className="flex items-center gap-2 text-[10px] font-normal text-slate-500">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Leads</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Receita</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={charts.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Line yAxisId="right" type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader><CardTitle className="text-sm font-bold">Performance Regional</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.regionalData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={30} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={16}>
                                    {charts.regionalData.map((entry, index) => <Cell key={index} fill={entry.name === selectedState ? '#6366f1' : '#38bdf8'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Intelligence (Notes & Keywords) */}
            <Card className="bg-slate-950 border-slate-800 shadow-xl">
                <CardHeader className="pb-4 border-b border-slate-900">
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="h-5 w-5 text-purple-400" />
                        <div>
                            <CardTitle className="text-white text-base">Inteligência de Vendas</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">
                                Análise semântica das anotações (Bigrams & Keywords)
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Why we Win */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Smile className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Motivos de Ganho</h4>
                            </div>
                            <div className="space-y-2">
                                {salesIntelligence.won.length > 0 ? salesIntelligence.won.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs group cursor-pointer hover:bg-slate-900/50 p-1 rounded" onClick={() => setSelectedKeyword(selectedKeyword === item.word ? null : item.word)}>
                                        <span className={cn("font-medium", selectedKeyword === item.word ? "text-emerald-400" : "text-slate-300")}>{item.word}</span>
                                        <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-500">{item.count}</Badge>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-slate-500 italic">Poucos dados.</p>
                                )}
                            </div>
                        </div>

                        {/* Why we Lose */}
                        <div className="space-y-4 border-l border-slate-900 pl-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Frown className="w-4 h-4 text-rose-400" />
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Motivos da Perda</h4>
                            </div>
                            <div className="space-y-2">
                                {salesIntelligence.lost.length > 0 ? salesIntelligence.lost.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs group cursor-pointer hover:bg-slate-900/50 p-1 rounded" onClick={() => setSelectedKeyword(selectedKeyword === item.word ? null : item.word)}>
                                        <span className={cn("font-medium", selectedKeyword === item.word ? "text-rose-400" : "text-slate-300")}>{item.word}</span>
                                        <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-500">{item.count}</Badge>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-slate-500 italic">Poucos dados.</p>
                                )}
                            </div>
                        </div>

                        {/* Active Topics */}
                        <div className="space-y-4 border-l border-slate-900 pl-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Flame className="w-4 h-4 text-amber-400" />
                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Em Pauta</h4>
                            </div>
                            <div className="space-y-2">
                                {salesIntelligence.active.length > 0 ? salesIntelligence.active.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs group cursor-pointer hover:bg-slate-900/50 p-1 rounded" onClick={() => setSelectedKeyword(selectedKeyword === item.word ? null : item.word)}>
                                        <span className={cn("font-medium", selectedKeyword === item.word ? "text-amber-400" : "text-slate-300")}>{item.word}</span>
                                        <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-500">{item.count}</Badge>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-slate-500 italic">Poucos dados.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* UTM Performance Grid (New) */}
            {utmStats.length > 0 && (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-blue-500" />
                            Performance de UTMs
                        </CardTitle>
                        <CardDescription className="text-[10px]">Origem / Mídia e suas Campanhas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {utmStats.map((utm, idx) => (
                                <div key={idx} className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="font-semibold text-xs text-slate-700 dark:text-slate-200">{utm.name}</h5>
                                        <Badge variant="secondary">{utm.size} Leads</Badge>
                                    </div>
                                    <p className="text-[10px] text-slate-500 line-clamp-2">
                                        {utm.campaigns || "Sem campanha específica"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Traffic & Origin */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source Pie */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-purple-500" />
                            Leads por Origem
                        </CardTitle>
                        <CardDescription className="text-[10px]">Distribuição por canal (UTM + Manual)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={newMetrics.sourceData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name} ${(percent ? (percent * 100) : 0).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {newMetrics.sourceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Conversion Bar */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-500" />
                            Conversão por Origem
                        </CardTitle>
                        <CardDescription className="text-[10px]">Quem fecha mais negócios?</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={newMetrics.conversionData.slice(0, 8)} // Top 8 sources
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="rate" name="Taxa de Conversão (%)" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={16}>
                                    {newMetrics.conversionData.map((entry, index) => (
                                        <Cell key={`cell-conv-${index}`} fill={entry.rate > 20 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            Top Campanhas
                        </CardTitle>
                        <CardDescription className="text-[10px]">Volume por utm_campaign</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {newMetrics.campaignData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={newMetrics.campaignData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={60} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                    <Bar dataKey="leads" name="Leads" fill="#8884d8" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                Nenhuma campanha identificada.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            Top Páginas
                        </CardTitle>
                        <CardDescription className="text-[10px]">Conversão por Page Path</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {newMetrics.pageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={newMetrics.pageData}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                    <Bar dataKey="leads" name="Leads" fill="#0088FE" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                Nenhuma página identificada.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Leads Diários</CardTitle>
                    <CardDescription className="text-[10px]">Volume de leads por dia no período selecionado</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.dailyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="leads" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        Temperatura do Pipeline
                        {selectedColumn && <Badge variant="secondary" onClick={() => setSelectedColumn(null)} className="cursor-pointer text-[10px]">✕ {selectedColumn}</Badge>}
                    </CardTitle>
                    <CardDescription className="text-[10px]">Clique em uma etapa para ver os leads</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.funnelData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={120} tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} className="cursor-pointer" onClick={(data) => { if (data && data.name) setSelectedColumn(data.name === selectedColumn ? null : data.name) }}>
                                {charts.funnelData.map((entry, index) => (
                                    <Cell key={index} fill={entry.name === selectedColumn ? '#ffffff' : entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
