"use client";

import { useMemo, useState } from "react";
import { Lead, Column } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell,
    PieChart, Pie, Legend
} from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Wallet, TrendingUp, Users, Target, Clock, CalendarClock,
    RotateCcw, Flame, FileText, MousePointerClick, Gem, BrainCircuit, Link2,
    AlertTriangle, CheckCircle2, XCircle, Activity, Zap, Timer, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { KPI } from "./analytics-components";
import { processAnalyticsData, calculateConversionBySource, getStaleAlerts, getFunnelData, getVelocityMetrics, getFollowUpMetrics, getHealthScore } from "@/lib/analytics-helper";
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
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 90),
        to: new Date()
    });
    const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
    const [selectedState, setSelectedState] = useState<string>("all");
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

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

    const {
        kpis, charts, uniqueOrigins, states, newMetrics,
        intelligence, utmStats
    } = useMemo(() => {
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

        const activeLeads = filtered.filter(lead => {
            if (selectedColumn && lead.columnId !== columns.find(c => c.title === selectedColumn)?.id) return false;
            return true;
        });

        const uniqueOrigins = Array.from(new Set(initialLeads.map(l => l.campaignSource || "Direto").filter(Boolean))).sort();
        const states = Array.from(new Set(initialLeads.map(l => getStateFromPhone(l.whatsapp)))).sort();

        // KPIs
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
        const utmStats = activeLeads.reduce((acc, lead) => {
            if (lead.utmSource || lead.utmMedium || lead.utmCampaign) {
                const key = `${lead.utmSource || 'N/A'} / ${lead.utmMedium || 'N/A'} / ${lead.utmCampaign || 'N/A'}`;
                if (!acc[key]) acc[key] = { name: key, source: lead.utmSource || '-', medium: lead.utmMedium || '-', campaign: lead.utmCampaign || '-', term: lead.utmTerm || '-', content: lead.utmContent || '-', size: 0 };
                acc[key].size++;
            }
            return acc;
        }, {} as Record<string, { name: string, source: string, medium: string, campaign: string, term: string, content: string, size: number }>);
        const utmTreeData = Object.values(utmStats).sort((a, b) => b.size - a.size).slice(0, 20);

        return {
            uniqueOrigins, states,
            kpis: { revenue, pipeline, totalLeads: totalLeadsCount, conversionRate, averageTicket, avgCycle, followUpsCount },
            charts: { monthlyData, regionalData, dailyData, funnelData },
            newMetrics: { ...processedNewMetrics, conversionData },
            intelligence: { staleAlerts, funnel, velocity, followUp, health },
            utmStats: utmTreeData
        };
    }, [initialLeads, columns, dateRange, selectedOrigin, selectedState, selectedColumn]);

    const handleReset = () => {
        setDateRange({ from: subDays(new Date(), 90), to: new Date() });
        setSelectedOrigin('all');
        setSelectedState('all');
        setSelectedColumn(null);
    };

    const gradeColors: Record<string, string> = { A: 'text-emerald-400', B: 'text-green-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400' };
    const gradeBg: Record<string, string> = { A: 'bg-emerald-500/20', B: 'bg-green-500/20', C: 'bg-amber-500/20', D: 'bg-orange-500/20', F: 'bg-red-500/20' };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-4">
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
                {(selectedColumn || selectedOrigin !== "all" || selectedState !== "all") && (
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

            {/* ===== SALES INTELLIGENCE v3 ===== */}
            <Card className="bg-slate-950 border-slate-800 shadow-xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrainCircuit className="h-5 w-5 text-purple-400" />
                            <div>
                                <CardTitle className="text-white text-base">Inteligência de Vendas</CardTitle>
                                <CardDescription className="text-[10px] text-slate-500">
                                    Insights acionáveis baseados em dados reais do pipeline
                                </CardDescription>
                            </div>
                        </div>
                        {/* Health Score Badge */}
                        <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full", gradeBg[intelligence.health.grade])}>
                            <Activity className={cn("h-4 w-4", gradeColors[intelligence.health.grade])} />
                            <span className={cn("text-lg font-bold", gradeColors[intelligence.health.grade])}>
                                {intelligence.health.score}
                            </span>
                            <span className={cn("text-xs font-bold", gradeColors[intelligence.health.grade])}>
                                / 100
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Health Factors */}
                    <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-900/30">
                        <div className="flex flex-wrap gap-3">
                            {intelligence.health.factors.map((f, i) => (
                                <div key={i} className={cn(
                                    "flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full",
                                    f.status === 'positive' && "bg-emerald-500/10 text-emerald-400",
                                    f.status === 'warning' && "bg-amber-500/10 text-amber-400",
                                    f.status === 'critical' && "bg-red-500/10 text-red-400",
                                )}>
                                    {f.status === 'positive' && <CheckCircle2 className="h-3 w-3" />}
                                    {f.status === 'warning' && <AlertTriangle className="h-3 w-3" />}
                                    {f.status === 'critical' && <XCircle className="h-3 w-3" />}
                                    {f.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                        {/* Stale Alerts */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Leads Parados</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-red-500/10 rounded-lg p-2">
                                    <div className="text-xl font-bold text-red-400">{intelligence.staleAlerts.critical.length}</div>
                                    <div className="text-[9px] text-red-400/70">+15 dias</div>
                                </div>
                                <div className="bg-amber-500/10 rounded-lg p-2">
                                    <div className="text-xl font-bold text-amber-400">{intelligence.staleAlerts.warning.length}</div>
                                    <div className="text-[9px] text-amber-400/70">7-15 dias</div>
                                </div>
                                <div className="bg-emerald-500/10 rounded-lg p-2">
                                    <div className="text-xl font-bold text-emerald-400">{intelligence.staleAlerts.healthy}</div>
                                    <div className="text-[9px] text-emerald-400/70">Ativos</div>
                                </div>
                            </div>
                            {intelligence.staleAlerts.critical.length > 0 && (
                                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                                    {intelligence.staleAlerts.critical.slice(0, 5).map(l => (
                                        <div key={l.id} className="flex items-center justify-between text-[10px] bg-red-500/5 rounded px-2 py-1.5">
                                            <span className="text-slate-300 truncate max-w-[140px]">{l.name}</span>
                                            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">{l.daysStale}d · {l.stageName}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Velocity */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-blue-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Velocidade</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-blue-400">{intelligence.velocity.avgDaysToClose || '—'}</div>
                                    <div className="text-[9px] text-slate-500">dias p/ fechar</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-rose-400">{intelligence.velocity.avgDaysToLose || '—'}</div>
                                    <div className="text-[9px] text-slate-500">dias p/ perder</div>
                                </div>
                            </div>
                            {intelligence.velocity.avgDaysByStage.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">Tempo médio por etapa</div>
                                    {intelligence.velocity.avgDaysByStage.slice(0, 4).map(s => (
                                        <div key={s.stage} className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-400 truncate max-w-[120px]">{s.stage}</span>
                                            <span className={cn("font-mono font-bold", s.avgDays > 15 ? 'text-red-400' : s.avgDays > 7 ? 'text-amber-400' : 'text-emerald-400')}>{s.avgDays}d</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Follow-up */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-purple-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Follow-ups</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className={cn("rounded-lg p-3 text-center", intelligence.followUp.overdueLeads.length > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
                                    <div className={cn("text-lg font-bold", intelligence.followUp.overdueLeads.length > 0 ? "text-red-400" : "text-emerald-400")}>
                                        {intelligence.followUp.overdueLeads.length}
                                    </div>
                                    <div className="text-[9px] text-slate-500">vencidos</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-purple-400">{intelligence.followUp.complianceRate}%</div>
                                    <div className="text-[9px] text-slate-500">em dia</div>
                                </div>
                            </div>
                            {intelligence.followUp.overdueLeads.length > 0 && (
                                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                                    <div className="text-[9px] text-red-400/70 uppercase tracking-wider">⚠ Precisam de ação</div>
                                    {intelligence.followUp.overdueLeads.slice(0, 5).map(l => (
                                        <div key={l.id} className="flex items-center justify-between text-[10px] bg-red-500/5 rounded px-2 py-1.5">
                                            <span className="text-slate-300 truncate max-w-[140px]">{l.name}</span>
                                            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">{l.daysOverdue}d atraso</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {intelligence.followUp.overdueLeads.length === 0 && intelligence.followUp.totalWithFollowUp === 0 && (
                                <p className="text-[10px] text-slate-500 text-center py-2">Nenhum follow-up agendado</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

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

            {/* UTM Grid */}
            {utmStats.length > 0 && (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-blue-500" />
                            Performance de UTMs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950 p-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <div className="col-span-2">Source</div>
                                <div className="col-span-2">Medium</div>
                                <div className="col-span-4">Campaign</div>
                                <div className="col-span-2">Term</div>
                                <div className="col-span-2 text-right">Leads</div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                                {utmStats.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 p-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <div className="col-span-2 truncate pr-2">{item.source}</div>
                                        <div className="col-span-2 truncate pr-2 text-slate-500">{item.medium}</div>
                                        <div className="col-span-4 truncate pr-2 font-medium text-blue-600 dark:text-blue-400">{item.campaign}</div>
                                        <div className="col-span-2 truncate pr-2 text-slate-500">{item.term}</div>
                                        <div className="col-span-2 text-right font-bold">{item.size}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Traffic & Origin */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-purple-500" /> Leads por Origem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={newMetrics.sourceData} cx="50%" cy="50%" labelLine={false}
                                    label={({ name, percent }: any) => `${name} ${(percent ? (percent * 100) : 0).toFixed(0)}%`}
                                    outerRadius={80} fill="#8884d8" dataKey="value">
                                    {newMetrics.sourceData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-500" /> Conversão por Origem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={newMetrics.conversionData.slice(0, 8)} margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Bar dataKey="rate" name="Conversão (%)" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={16}>
                                    {newMetrics.conversionData.map((entry, index) => (
                                        <Cell key={index} fill={entry.rate > 20 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Daily + Pipeline */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader><CardTitle className="text-sm font-bold">Leads Diários</CardTitle></CardHeader>
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
