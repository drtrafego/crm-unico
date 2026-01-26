'use client';

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, Legend, Cell } from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, AlertOctagon, Clock, CalendarClock,
    RotateCcw, Phone, Mail, Video, MessageSquare, Smile, Frown, Flame, FileText,
    CheckCircle2, Search, Crosshair, ArrowUpRight, BarChart3, FilterX, CalendarIcon, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI, InsightStat, ActionTag, PeriodSummary } from "./analytics-components";

// --- Colors & Helpers ---
const PIPELINE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1"];

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
    let clean = phone?.replace(/\D/g, '') || '';
    if (clean.length >= 12 && clean.startsWith('55')) clean = clean.substring(2);
    if (clean.length < 10) return 'Desc.';
    return DD_TO_STATE[clean.substring(0, 2)] || 'Outros';
};

const parseValue = (val: any) => {
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

    // --- Key Identification ---
    const fechadoColumn = columns.find(c => /fechado|won|ganho|vendido/i.test(c.title));
    const perdidoColumn = columns.find(c => /perdido|lost|arquivado/i.test(c.title));

    // --- Data Processing & Metrics ---
    const {
        filteredLeads,
        interactiveLeads,
        kpis,
        charts,
        insights,
        uniqueOrigins,
        states,
        periodStats,
        nextFollowUps,
        keywordData
    } = useMemo(() => {
        // 1. Base Filter (Toolbar)
        const filtered = initialLeads.filter(lead => {
            if (dateRange?.from) {
                const start = startOfDay(dateRange.from);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                if (!isWithinInterval(new Date(lead.createdAt), { start, end })) return false;
            }
            if (selectedOrigin !== "all" && (lead.campaignSource || "Direto") !== selectedOrigin) return false;
            if (selectedState !== "all" && getStateFromPhone(lead.whatsapp) !== selectedState) return false;
            return true;
        });

        // 2. Interactive Filter (Click Selection)
        const activeLeads = filtered.filter(lead => {
            if (selectedColumn && lead.columnId !== columns.find(c => c.title === selectedColumn)?.id) return false;
            if (selectedKeyword) {
                const notes = (lead.notes || "").toLowerCase();
                const patterns: Record<string, RegExp> = {
                    "Interessados": /interesse|preço|valor|cotação/i,
                    "Sem Resposta": /sem resposta|vácuo|sumiu/i,
                    "Reunião": /reunião|call|agendar|visita/i,
                    "Whatsapp": /whatsapp|zap|whats/i,
                    "Email": /email|e-mail|enviado/i
                };
                if (patterns[selectedKeyword] && !patterns[selectedKeyword].test(notes)) return false;
            }
            return true;
        });

        // 3. Metadata Lists (Use Base Filter so options exist)
        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => l.campaignSource || "Direto").filter(Boolean))).sort();
        const states = Array.from(new Set(initialLeads.map(l => getStateFromPhone(l.whatsapp)))).sort();

        // 4. KPIs (Based on Interactive Selection)
        const totalLeads = activeLeads.length;
        const wonLeads = fechadoColumn ? activeLeads.filter(l => l.columnId === fechadoColumn.id) : [];
        const lostLeads = perdidoColumn ? activeLeads.filter(l => l.columnId === perdidoColumn.id) : [];
        const openLeads = activeLeads.filter(l => l.columnId !== fechadoColumn?.id && l.columnId !== perdidoColumn?.id);

        const revenue = wonLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const pipeline = openLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const conversionRate = totalLeads ? (wonLeads.length / totalLeads) * 100 : 0;
        const lossRate = totalLeads ? (lostLeads.length / totalLeads) * 100 : 0;

        const avgCycle = wonLeads.length
            ? Math.round(wonLeads.reduce((acc, l) => acc + differenceInDays(new Date(), new Date(l.createdAt)), 0) / wonLeads.length)
            : 0;

        const followUpsCount = activeLeads.filter(l => l.followUpDate && new Date(l.followUpDate) >= startOfDay(new Date())).length;

        // 5. Charts - Data (Interactive)
        // Monthly
        const monthlyDataMap: any = {};
        activeLeads.forEach(l => {
            const m = format(new Date(l.createdAt), 'MMM/yy', { locale: ptBR });
            if (!monthlyDataMap[m]) monthlyDataMap[m] = { month: m, leads: 0, revenue: 0, sortDate: startOfDay(new Date(l.createdAt)) };
            monthlyDataMap[m].leads++;
            if (fechadoColumn && l.columnId === fechadoColumn.id) monthlyDataMap[m].revenue += parseValue(l.value);
        });
        const monthlyData = Object.values(monthlyDataMap).sort((a: any, b: any) => a.sortDate - b.sortDate);

        // Regional
        const stateCount: Record<string, number> = {};
        activeLeads.forEach(l => {
            const s = getStateFromPhone(l.whatsapp);
            stateCount[s] = (stateCount[s] || 0) + 1;
        });
        const regionalData = Object.entries(stateCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 8);

        // Daily
        const dailyData = (() => {
            if (!dateRange?.from) return [];
            const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to || dateRange.from });
            const effectiveDays = days.length > 60 ? days.filter((_, i) => i % Math.ceil(days.length / 60) === 0) : days;
            return effectiveDays.map(d => ({
                day: format(d, 'dd/MM'),
                leads: activeLeads.filter(l => format(new Date(l.createdAt), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length
            }));
        })();

        // 6. Funnel (Base Filter - remains visible but highlights selected)
        const funnelData = columns.map(col => ({
            name: col.title,
            value: filtered.filter(l => l.columnId === col.id).length,
            fill: PIPELINE_COLORS[columns.indexOf(col) % PIPELINE_COLORS.length]
        })).filter(d => d.value > 0);

        // 7. Insights Logic (Interactive)
        let stats = { positive: 0, negative: 0, urgent: 0, avgChars: 0, charCount: 0, notesCount: 0 };
        let actions = { interested: 0, talking: 0, waiting: 0, proposal: 0, meeting: 0, analyzing: 0, email: 0, videocall: 0 };

        activeLeads.forEach(l => {
            if (!l.notes) return;
            const text = l.notes.toLowerCase();
            stats.notesCount++;
            stats.charCount += text.length;

            if (/(interess|gostou|top|fech|aprov|sim)/.test(text)) stats.positive++;
            if (/(desinter|caro|cancel|ruim|não)/.test(text)) stats.negative++;
            if (/(urge|press|hoje|agora)/.test(text)) stats.urgent++;

            if (/(interess)/.test(text)) actions.interested++;
            if (/(faland|contato|whatsapp)/.test(text)) actions.talking++;
            if (/(aguard|retorno|espera)/.test(text)) actions.waiting++;
            if (/(proposta|orçament|preço)/.test(text)) actions.proposal++;
            if (/(reuni|visit|presencial)/.test(text)) actions.meeting++;
            if (/(analis|verific|pensar)/.test(text)) actions.analyzing++;
            if (/(email|e-mail)/.test(text)) actions.email++;
            if (/(video|call|meet|zoom)/.test(text)) actions.videocall++;
        });
        stats.avgChars = stats.notesCount ? Math.round(stats.charCount / stats.notesCount) : 0;

        // 8. Keyword Data (Base Filter - so tags are visible)
        const tagCounts: Record<string, number> = {};
        filtered.forEach(l => {
            const text = (l.notes || "").toLowerCase();
            if (/(interess)/.test(text)) tagCounts["Interessados"] = (tagCounts["Interessados"] || 0) + 1;
            if (/(sem resposta|vácuo)/.test(text)) tagCounts["Sem Resposta"] = (tagCounts["Sem Resposta"] || 0) + 1;
            if (/(reuni|visit)/.test(text)) tagCounts["Reunião"] = (tagCounts["Reunião"] || 0) + 1;
            if (/(whatsapp|zap)/.test(text)) tagCounts["Whatsapp"] = (tagCounts["Whatsapp"] || 0) + 1;
            if (/(email|e-mail)/.test(text)) tagCounts["Email"] = (tagCounts["Email"] || 0) + 1;
        });

        const keywordData = Object.entries(tagCounts).map(([keyword, count]) => {
            const colors: Record<string, string> = {
                "Interessados": "text-emerald-400",
                "Sem Resposta": "text-slate-500",
                "Reunião": "text-amber-400",
                "Whatsapp": "text-green-400",
                "Email": "text-blue-400"
            };
            return { keyword, count, color: colors[keyword] || "text-slate-400" };
        });

        const now = new Date();
        const l7 = activeLeads.filter(l => new Date(l.createdAt) >= subDays(now, 7));
        const l30 = activeLeads.filter(l => new Date(l.createdAt) >= subDays(now, 30));
        const getSales = (ls: Lead[]) => ls.filter(l => fechadoColumn && l.columnId === fechadoColumn.id).length;

        const periodStats = {
            l7: { count: l7.length, sales: getSales(l7) },
            l30: { count: l30.length, sales: getSales(l30) }
        };

        const nextFollowUps = activeLeads.filter(l => l.followUpDate && new Date(l.followUpDate) >= now)
            .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
            .slice(0, 2);

        return {
            filteredLeads: filtered,
            interactiveLeads: activeLeads,
            uniqueOrigins,
            states,
            kpis: { revenue, pipeline, totalLeads, conversionRate, lossRate, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData },
            insights: { stats, actions },
            periodStats,
            nextFollowUps,
            keywordData
        };
    }, [initialLeads, columns, dateRange, selectedOrigin, selectedState, selectedColumn, selectedKeyword, fechadoColumn, perdidoColumn]);

    const handleReset = () => {
        setDateRange({ from: subDays(new Date(), 90), to: new Date() });
        setSelectedOrigin('all');
        setSelectedState('all');
        setSelectedColumn(null);
        setSelectedKeyword(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Toolbar Filters */}
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
                    <SelectContent>
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        {uniqueOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="w-full md:w-[140px] bg-slate-900 border-slate-800 text-slate-100">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Estados</SelectItem>
                        {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>

                {(selectedColumn || selectedKeyword) && (
                    <Button variant="secondary" size="sm" onClick={() => { setSelectedColumn(null); setSelectedKeyword(null); }} className="ml-auto">
                        <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                    </Button>
                )}
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KPI label="Total Leads" value={kpis.totalLeads} icon={Users} color="text-slate-900 dark:text-white" />
                <KPI label="Ganhos" value={kpis.conversionRate.toFixed(1) + "%"} icon={CheckCircle2} color="text-emerald-500" iconBg="bg-emerald-500/10" />
                <KPI label="Perdidos" value={kpis.lossRate.toFixed(1) + "%"} icon={AlertOctagon} color="text-rose-500" iconBg="bg-rose-500/10" />
                <KPI label="Receita" value={formatCurrency(kpis.revenue)} icon={Wallet} color="text-emerald-600" iconBg="bg-emerald-600/10" />
                <KPI label="Pipeline" value={formatCurrency(kpis.pipeline)} icon={Target} color="text-blue-500" iconBg="bg-blue-500/10" />
                <KPI label="Ciclo Médio" value={`${kpis.avgCycle} dias`} icon={Clock} color="text-amber-500" iconBg="bg-amber-500/10" />
                <KPI label="Follow-ups" value={kpis.followUpsCount} icon={CalendarClock} color="text-indigo-500" iconBg="bg-indigo-500/10" />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue/Leads Timeline */}
                <Card className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                            Evolução de Vendas
                            <div className="flex items-center gap-2 text-xs font-normal text-slate-500">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Receita</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Leads</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={charts.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar yAxisId="right" dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.8} />
                                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Regional Stats */}
                <Card className="col-span-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader><CardTitle className="text-base">Top Regiões</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.regionalData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={30} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer" onClick={(data) => { if (data && data.name) setSelectedState(data.name === selectedState ? "all" : data.name) }}>
                                    {charts.regionalData.map((entry, index) => <Cell key={index} fill={entry.name === selectedState ? '#6366f1' : '#38bdf8'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Indicator */}
            {(selectedColumn || selectedKeyword) && (
                <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-indigo-200">
                        Filtrando por:
                        {selectedColumn && <Badge className="ml-2 bg-indigo-500">{selectedColumn}</Badge>}
                        {selectedKeyword && <Badge className="ml-2 bg-amber-500">{selectedKeyword}</Badge>}
                    </span>
                    <span className="text-xs text-slate-400">
                        Mostrando {interactiveLeads.length} de {filteredLeads.length} leads
                    </span>
                </div>
            )}

            {/* Row 2: Daily & Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader><CardTitle className="text-base">Leads Diários</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="leads" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            Temperatura do Pipeline
                            {selectedColumn && <Badge variant="secondary" onClick={() => setSelectedColumn(null)} className="cursor-pointer text-xs">✕ {selectedColumn}</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.funnelData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={100} tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} className="cursor-pointer" onClick={(data) => { if (data && data.name) setSelectedColumn(data.name === selectedColumn ? null : data.name) }}>
                                    {charts.funnelData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === selectedColumn ? '#ffffff' : entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Insights Section */}
            <Card className="bg-slate-950 border-slate-800 col-span-12 shadow-lg">
                <CardHeader className="pb-2 border-b border-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-white flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-indigo-400" />
                                Smart Insights
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Análise semântica das anotações em tempo real.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {/* Tags */}
                            {keywordData.map((k, i) => (
                                <ActionTag
                                    key={i}
                                    label={k.keyword}
                                    count={k.count}
                                    color={k.color}
                                    icon={TagIconMap[k.keyword] || Target}
                                    selected={selectedKeyword === k.keyword}
                                    onClick={() => setSelectedKeyword(selectedKeyword === k.keyword ? null : k.keyword)}
                                />
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Column 1: Semantic Stats */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Análise de Sentimento</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <InsightStat label="Positivo" value={insights.stats.positive} sublabel="leads interessados" color="text-emerald-400" icon={Smile} />
                            <InsightStat label="Negativo" value={insights.stats.negative} sublabel="objeções/recusas" color="text-rose-400" icon={Frown} />
                            <InsightStat label="Urgente" value={insights.stats.urgent} sublabel="querem pra hoje" color="text-amber-400" icon={Flame} />
                            <InsightStat label="Engajamento" value={insights.stats.avgChars} sublabel="caracteres média" color="text-blue-400" icon={FileText} />
                        </div>
                    </div>

                    {/* Column 2: Actions Matrix */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Ações Identificadas</h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <ActionItem label="Interessados" count={insights.actions.interested} color="text-emerald-400" />
                            <ActionItem label="Em Conversa" count={insights.actions.talking} color="text-blue-400" />
                            <ActionItem label="Aguardando" count={insights.actions.waiting} color="text-slate-400" />
                            <ActionItem label="Proposta" count={insights.actions.proposal} color="text-amber-400" />
                            <ActionItem label="Reunião" count={insights.actions.meeting} color="text-purple-400" />
                            <ActionItem label="Analisando" count={insights.actions.analyzing} color="text-cyan-400" />
                        </div>
                    </div>

                    {/* Column 3: Lead Feed (Interactive) */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col h-[300px]">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex justify-between">
                            <span>Feed de Leads ({interactiveLeads.length})</span>
                            <span className="text-slate-600 text-[10px]">Últimas interações</span>
                        </h4>
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-3">
                                {interactiveLeads.slice(0, 20).map(lead => (
                                    <div key={lead.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-slate-200 font-medium text-sm truncate">{lead.name}</span>
                                            <span className="text-[10px] text-slate-500">{format(new Date(lead.createdAt), 'dd/MM')}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                            {lead.notes || <span className="italic opacity-50">Sem anotações...</span>}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <Badge variant="outline" className="text-[10px] h-5 border-slate-800 text-slate-500">{lead.campaignSource || "Direto"}</Badge>
                                            {lead.whatsapp && <Badge variant="outline" className="text-[10px] h-5 border-slate-800 text-slate-500">{getStateFromPhone(lead.whatsapp)}</Badge>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Subcomponents helper
function ActionItem({ label, count, color }: { label: string, count: number, color: string }) {
    return (
        <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
            <span className="text-slate-400 text-sm">{label}</span>
            <span className={cn("font-bold font-mono", color)}>{count}</span>
        </div>
    );
}

const TagIconMap: Record<string, any> = {
    "Interessados": Target,
    "Sem Resposta": FilterX,
    "Reunião": CalendarClock,
    "Whatsapp": Phone,
    "Email": Mail
};
