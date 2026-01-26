"use client";

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell } from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, AlertOctagon, Clock, CalendarClock,
    RotateCcw, Smile, Frown, Flame, FileText, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI, InsightStat, ActionTag, PeriodSummary } from "./analytics-components";

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
        interactiveLeads,
        kpis,
        charts,
        insights,
        uniqueOrigins,
        states,
        periodStats,
        keywordData
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

        // 3. Metadata Lists
        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => l.campaignSource || "Direto").filter(Boolean))).sort();
        const states = Array.from(new Set(initialLeads.map(l => getStateFromPhone(l.whatsapp)))).sort();

        // 4. KPIs
        const totalLeadsCount = activeLeads.length;
        const wonLeads = activeLeads.filter(l => l.columnId && fechadoColumn && l.columnId === fechadoColumn.id);
        const lostLeads = activeLeads.filter(l => l.columnId && perdidoColumn && l.columnId === perdidoColumn.id);
        const openLeads = activeLeads.filter(l => l.columnId && (!fechadoColumn || l.columnId !== fechadoColumn.id) && (!perdidoColumn || l.columnId !== perdidoColumn.id));

        const revenue = wonLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const pipeline = openLeads.reduce((acc, l) => acc + parseValue(l.value), 0);
        const conversionRate = totalLeadsCount ? (wonLeads.length / totalLeadsCount) * 100 : 0;
        const lossRate = totalLeadsCount ? (lostLeads.length / totalLeadsCount) * 100 : 0;

        const avgCycle = wonLeads.length
            ? Math.round(wonLeads.reduce((acc, l) => acc + differenceInDays(new Date(), l.createdAt ? new Date(l.createdAt) : new Date()), 0) / wonLeads.length)
            : 0;

        const followUpsCount = activeLeads.filter(l => l.followUpDate && startOfDay(new Date(l.followUpDate)) >= startOfDay(new Date())).length;

        // 5. Charts
        // Monthly Evolution
        const monthlyDataMap: any = {};
        activeLeads.forEach(l => {
            if (!l.createdAt) return;
            const date = new Date(l.createdAt);
            const m = format(date, 'MMM/yy', { locale: ptBR });
            if (!monthlyDataMap[m]) monthlyDataMap[m] = { month: m, leads: 0, revenue: 0, sortDate: startOfDay(date) };
            monthlyDataMap[m].leads++;
            if (fechadoColumn && l.columnId === fechadoColumn.id) monthlyDataMap[m].revenue += parseValue(l.value);
        });
        const monthlyData = Object.values(monthlyDataMap).sort((a: any, b: any) => a.sortDate - b.sortDate);

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

        // 6. Insights logic
        const sentimentStats = { positive: 0, negative: 0, urgent: 0, avgChars: 0, charCount: 0, notesCount: 0 };
        const actionItems = { interested: 0, talking: 0, waiting: 0, proposal: 0, meeting: 0 };

        activeLeads.forEach(l => {
            if (!l.notes) return;
            const text = l.notes.toLowerCase();
            sentimentStats.notesCount++;
            sentimentStats.charCount += text.length;

            if (/(interess|gostou|top|fech|aprov|sim)/.test(text)) sentimentStats.positive++;
            if (/(desinter|caro|cancel|ruim|não)/.test(text)) sentimentStats.negative++;
            if (/(urge|press|hoje|agora)/.test(text)) sentimentStats.urgent++;

            if (/(interess)/.test(text)) actionItems.interested++;
            if (/(faland|contato|whatsapp)/.test(text)) actionItems.talking++;
            if (/(aguard|retorno|espera)/.test(text)) actionItems.waiting++;
            if (/(proposta|orçament|preço)/.test(text)) actionItems.proposal++;
            if (/(reuni|visit|presencial)/.test(text)) actionItems.meeting++;
        });
        sentimentStats.avgChars = sentimentStats.notesCount ? Math.round(sentimentStats.charCount / sentimentStats.notesCount) : 0;

        const tagCounts: Record<string, number> = {};
        filtered.forEach(l => {
            const text = (l.notes || "").toLowerCase();
            if (/(interess)/.test(text)) tagCounts["Interessados"] = (tagCounts["Interessados"] || 0) + 1;
            if (/(sem resposta|vácuo)/.test(text)) tagCounts["Sem Resposta"] = (tagCounts["Sem Resposta"] || 0) + 1;
            if (/(reuni|visit)/.test(text)) tagCounts["Reunião"] = (tagCounts["Reunião"] || 0) + 1;
            if (/(whatsapp|zap)/.test(text)) tagCounts["Whatsapp"] = (tagCounts["Whatsapp"] || 0) + 1;
        });

        const keywordData = Object.entries(tagCounts).map(([keyword, count]) => {
            const colors: Record<string, string> = {
                "Interessados": "text-emerald-400",
                "Sem Resposta": "text-slate-500",
                "Reunião": "text-amber-400",
                "Whatsapp": "text-green-400"
            };
            return { keyword, count, color: colors[keyword] || "text-slate-400" };
        });

        const now = new Date();
        const l7 = activeLeads.filter(l => l.createdAt && new Date(l.createdAt) >= subDays(now, 7));
        const l30 = activeLeads.filter(l => l.createdAt && new Date(l.createdAt) >= subDays(now, 30));
        const getSalesCount = (ls: Lead[]) => ls.filter(l => l.columnId && fechadoColumn && l.columnId === fechadoColumn.id).length;

        const periodStats = {
            l7: { count: l7.length, sales: getSalesCount(l7) },
            l30: { count: l30.length, sales: getSalesCount(l30) }
        };

        return {
            interactiveLeads: activeLeads,
            uniqueOrigins,
            states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, lossRate, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData },
            insights: { sentimentStats, actionItems },
            periodStats,
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
                <KPI label="Taxa de Perda" value={kpis.lossRate.toFixed(1) + "%"} icon={AlertOctagon} color="text-rose-500" iconBg="bg-rose-500/10" />
                <KPI label="Ciclo Médio" value={`${kpis.avgCycle} dias`} icon={Clock} color="text-amber-500" iconBg="bg-amber-500/10" />
                <KPI label="Follow-ups" value={kpis.followUpsCount} icon={CalendarClock} color="text-indigo-500" iconBg="bg-indigo-500/10" />
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

            {/* Insights Section */}
            <Card className="bg-slate-950 border-slate-800 shadow-xl">
                <CardHeader className="pb-4 border-b border-slate-900">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-400" />
                            <div>
                                <CardTitle className="text-white text-base">Insights das Observações</CardTitle>
                                <CardDescription className="text-[10px] text-slate-500 space-x-1">Análise automática das anotações dos leads</CardDescription>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <InsightStat label="Positivos" value={insights.sentimentStats.positive} sublabel="Potenciais clientes" color="text-emerald-400" icon={Smile} />
                            <InsightStat label="Negativos" value={insights.sentimentStats.negative} sublabel="Sem interesse no momento" color="text-rose-400" icon={Frown} />
                            <InsightStat label="Urgentes" value={insights.sentimentStats.urgent} sublabel="Atendimento imediato" color="text-amber-400" icon={Flame} />
                            <InsightStat label="Engajamento" value={insights.sentimentStats.avgChars} sublabel="Tamanho médio das notas" color="text-blue-400" icon={FileText} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Ações Mencionadas</h4>
                            <div className="flex flex-wrap gap-3">
                                {keywordData.map((item, idx) => (
                                    <ActionTag key={idx} label={item.keyword} count={item.count} color={item.color} icon={FileText} selected={selectedKeyword === item.keyword} onClick={() => setSelectedKeyword(selectedKeyword === item.keyword ? null : item.keyword)} />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Últimas Observações</h4>
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {interactiveLeads.filter(l => l.notes).slice(0, 10).map(lead => (
                                        <div key={lead.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50 hover:border-slate-700 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-slate-200 font-bold text-xs">{lead.name}</span>
                                                <span className="text-[9px] text-slate-500">{lead.createdAt ? format(new Date(lead.createdAt), 'dd/MM') : '--/--'}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed italic">
                                                {lead.notes}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col justify-between">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Resumo por Período</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <PeriodSummary title="Últimos 7 dias" leads={periodStats.l7.count} sales={periodStats.l7.sales} color="text-indigo-400" />
                                        <PeriodSummary title="Últimos 30 dias" leads={periodStats.l30.count} sales={periodStats.l30.sales} color="text-purple-400" />
                                    </div>
                                </div>
                                <div className="mt-auto pt-6 flex flex-col gap-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Taxa de Anotação</span>
                                        <span className="text-white font-black text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                                            {Math.round((insights.sentimentStats.notesCount / (kpis.totalLeads || 1)) * 100)}%
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-900/50 rounded-full border border-slate-800 overflow-hidden p-[2px]">
                                        <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${(insights.sentimentStats.notesCount / (kpis.totalLeads || 1)) * 100}%` }} />
                                    </div>
                                    <p className="text-[9px] text-slate-500 italic mt-1 text-center">Leads com observações registradas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
