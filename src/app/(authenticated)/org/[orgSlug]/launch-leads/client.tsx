"use client";

import { LaunchLead } from "@/server/db/schema";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, FileText, Activity, TrendingUp, Database, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { syncLaunchLeadsFromSheet } from "@/server/actions/launch-leads";

const ReactWordcloud = dynamic(() => import("react-wordcloud"), {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center text-slate-500 text-sm">Carregando nuvem...</div>
});
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    Legend,
} from "recharts";

// ----------- Types -----------
interface AnalyticsData {
    totalLeads: number;
    totalForms: number;
    trackingRate: number;
    trackedLeadsCount: number;
    utmRanking: { name: string; value: number }[];
    utmMediumRanking: { name: string; value: number }[];
    utmTermRanking: { name: string; value: number }[];
    utmContentRanking: { name: string; value: number }[];
    utmCampaignRanking: { name: string; value: number }[];
    dailyTimeline: { date: string; count: number }[];
    temperatureData: { name: string; value: number }[];
    columnCharts: { columnName: string; displayName: string; type: string; data: { name: string; value: number }[] }[];
    wordCloudColumns: { columnName: string; words: { text: string; value: number }[] }[];
    wordCloud: { text: string; value: number }[];
}

// ... (CHART_COLORS)
interface LaunchLeadsClientProps {
    data: LaunchLead[];
    organizationId: string;
    analytics?: AnalyticsData | null;
}

// --------- Palette for charts (vibrant) ----------
const CHART_COLORS = [
    "#818cf8", "#a78bfa", "#f472b6", "#34d399", "#fb923c",
    "#38bdf8", "#fbbf24", "#c084fc", "#4ade80", "#f87171",
    "#60a5fa", "#e879f9", "#2dd4bf", "#facc15", "#fb7185"
];

// ----------- Word Cloud Component -----------
function WordCloud({ words }: { words: { text: string; value: number }[] }) {
    if (!words || words.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center text-slate-500 text-sm italic">
                Nenhuma palavra relevante encontrada.
            </div>
        );
    }

    const options = {
        colors: CHART_COLORS,
        enableTooltip: true,
        deterministic: true,
        fontFamily: "Inter, sans-serif",
        fontSizes: [14, 48] as [number, number],
        fontStyle: "normal",
        fontWeight: "bold",
        padding: 4,
        rotations: 2,
        rotationAngles: [0, 45] as [number, number],
        scale: "sqrt" as const,
        spiral: "archimedean" as const,
        transitionDuration: 1000,
    };

    return (
        <div className="h-64 w-full">
            <ReactWordcloud words={words} options={options} />
        </div>
    );
}

// ----------- Ranking Table -----------
function RankingTable({ data, label }: { data: { name: string; value: number }[], label: string }) {
    const total = (data ?? []).reduce((s, d) => s + (d?.value ?? 0), 0);
    return (
        <div className="rounded-lg overflow-hidden border border-slate-700/50">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-800/80">
                        <th className="text-left px-4 py-2.5 text-slate-300 font-semibold">{label}</th>
                        <th className="text-right px-4 py-2.5 text-slate-300 font-semibold">Leads</th>
                        <th className="text-right px-4 py-2.5 text-slate-300 font-semibold">%</th>
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 15).map((row, i) => {
                        const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
                        return (
                            <tr key={i} className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2.5 text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 w-5 shrink-0">{i + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate font-medium text-slate-200" title={row.name}>{row.name}</div>
                                            <div className="h-1 mt-1 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-1 rounded-full bg-violet-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-slate-100">{row.value.toLocaleString('pt-BR')}</td>
                                <td className="px-4 py-2.5 text-right text-slate-400">{pct}%</td>
                            </tr>
                        );
                    })}
                    {data.length > 0 && (
                        <tr className="border-t border-slate-600 bg-slate-800/60">
                            <td className="px-4 py-2.5 text-slate-300 font-semibold">Total</td>
                            <td className="px-4 py-2.5 text-right font-bold text-white">{total.toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">100%</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ----------- Section Container -----------
function DashSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-700/40 bg-slate-800/50">
                <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ----------- Donut/Pie Chart Sub-component -----------
const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number; name?: string;
}) {
    if (!percent || percent < 0.04) return null;
    const ir = innerRadius ?? 0;
    const or = outerRadius ?? 0;
    const mA = midAngle ?? 0;
    const cxVal = cx ?? 0;
    const cyVal = cy ?? 0;
    const radius = ir + (or - ir) * 0.5;
    const x = cxVal + radius * Math.cos(-mA * RADIAN);
    const y = cyVal + radius * Math.sin(-mA * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}

// ----------- Dynamic Form Column Chart -----------
function ColumnChart({ chart }: { chart: AnalyticsData['columnCharts'][0] }) {
    const colors = CHART_COLORS;
    if (chart.type === 'pie' || chart.type === 'boolean') {
        return (
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chart.data ?? []}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            labelLine={false}
                            label={renderCustomLabel}
                        >
                            {(chart.data ?? []).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }
    return (
        <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data ?? []} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={130} />
                    <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {(chart.data ?? []).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// =========== Main Component ===========
export function LaunchLeadsClient({ data, organizationId, analytics }: LaunchLeadsClientProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncLaunchLeadsFromSheet(organizationId);
            if (res.success) {
                alert(res.message);
                window.location.reload();
            } else {
                alert(`Erro: ${res.error}`);
            }
        } catch (error) {
            console.error(error);
            alert("Erro inesperado ao sincronizar.");
        } finally {
            setIsSyncing(false);
        }
    };

    const hasData = analytics && analytics.totalLeads > 0;

    return (
        <div className="space-y-6">
            {/* ── Header Bar ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 via-violet-950/40 to-slate-900/60 p-5 backdrop-blur shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-500/20 p-2.5">
                        <Database className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Integração Google Sheets</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Sincronize as respostas do formulário com o CRM.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 border border-indigo-500/30"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Planilha"}
                </Button>
            </div>

            {!mounted ? (
                <div className="flex h-96 items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : hasData && analytics && (
                <>
                    {/* ── KPI Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Total de Leads", value: (analytics.totalLeads ?? 0).toLocaleString('pt-BR'), sub: "Captação via páginas", icon: Users, color: "indigo" },
                            { label: "Leads Rastreados", value: (analytics.trackedLeadsCount ?? 0).toLocaleString('pt-BR'), sub: "Com UTM Source", icon: Activity, color: "violet" },
                            { label: "Taxa de Rastreio", value: `${analytics.trackingRate ?? 0}%`, sub: "Leads com UTM / Total", icon: TrendingUp, color: "purple" },
                            { label: "Respostas do Form", value: (analytics.totalForms ?? 0).toLocaleString('pt-BR'), sub: "Sincronizados da planilha", icon: FileText, color: "fuchsia" },
                        ].map((card, i) => (
                            <div
                                key={i}
                                className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/70 p-5 backdrop-blur group hover:border-slate-600/60 transition-all"
                            >
                                <div className={`absolute top-0 right-0 w-24 h-24 bg-${card.color}-500/5 rounded-bl-full`} />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">{card.label}</p>
                                        <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                                        <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
                                    </div>
                                    <div className={`rounded-lg bg-${card.color}-500/10 p-2`}>
                                        <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── UTM SOURCE ── */}
                    <DashSection title="📍 Captação — UTM Source">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <p className="text-xs text-slate-400 mb-3">Evolução diária de leads captados</p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={analytics.dailyTimeline ?? []}>
                                            <defs>
                                                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} fill="url(#colorLeads)" dot={false} name="Leads" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 mb-3">Ranking de origens</p>
                                <RankingTable data={analytics.utmRanking ?? []} label="UTM Source" />
                            </div>
                        </div>
                    </DashSection>

                    {/* ── UTM MEDIUM ── */}
                    <DashSection title="📡 Captação — UTM Medium">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-400 mb-3">Distribuição por mídia</p>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(analytics.utmMediumRanking ?? []).slice(0, 12)} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={150} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                            />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Leads">
                                                {(analytics.utmMediumRanking ?? []).slice(0, 12).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 mb-3">Ranking de mídias</p>
                                <RankingTable data={analytics.utmMediumRanking ?? []} label="UTM Medium" />
                            </div>
                        </div>
                    </DashSection>

                    {/* ── UTM TERM + UTM CONTENT ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <DashSection title="🔖 Captação — UTM Term">
                            <div className="space-y-5">
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={(analytics.utmTermRanking ?? []).slice(0, 10)}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={35}
                                                labelLine={false}
                                                label={renderCustomLabel}
                                            >
                                                {(analytics.utmTermRanking ?? []).slice(0, 10).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <RankingTable data={analytics.utmTermRanking ?? []} label="UTM Term" />
                            </div>
                        </DashSection>
                        <DashSection title="✍️ Captação — UTM Content">
                            <div className="space-y-5">
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(analytics.utmContentRanking ?? []).slice(0, 8)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                                            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Leads">
                                                {(analytics.utmContentRanking ?? []).slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <RankingTable data={analytics.utmContentRanking ?? []} label="UTM Content" />
                            </div>
                        </DashSection>
                    </div>

                    {/* ── UTM CAMPAIGN ── */}
                    <DashSection title="📢 Captação — UTM Campaign">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-400 mb-3">Distribuição por campanha</p>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={(analytics.utmCampaignRanking ?? []).slice(0, 10)}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                innerRadius={40}
                                                labelLine={false}
                                                label={renderCustomLabel}
                                            >
                                                {(analytics.utmCampaignRanking ?? []).slice(0, 10).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 mb-3">Ranking de campanhas</p>
                                <RankingTable data={analytics.utmCampaignRanking ?? []} label="UTM Campaign" />
                            </div>
                        </div>
                    </DashSection>

                    {/* ── TEMPERATURA P1 vs P2 ── */}
                    <DashSection title="🌡️ Temperatura dos Leads — P1 (Frio) vs P2 (Quente)">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-center">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.temperatureData ?? []}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            labelLine={false}
                                            label={renderCustomLabel}
                                        >
                                            <Cell fill="#60a5fa" />
                                            <Cell fill="#f87171" />
                                            <Cell fill="#94a3b8" />
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '13px', color: '#94a3b8' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3">
                                {(analytics.temperatureData ?? []).map((d, i) => {
                                    const total = (analytics.temperatureData ?? []).reduce((s, x) => s + (x?.value ?? 0), 0);
                                    const pct = total > 0 ? Math.round(((d?.value ?? 0) / total) * 100) : 0;
                                    const colors = ["#60a5fa", "#f87171", "#94a3b8"];
                                    return (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-300 font-medium">{d?.name ?? "Outros"}</span>
                                                <span className="text-slate-100 font-bold">{(d?.value ?? 0).toLocaleString('pt-BR')} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-2 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </DashSection>

                    {/* ── GRÁFICOS POR COLUNA DO FORMULÁRIO ── */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">📋 Análise por Coluna do Formulário</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {(analytics.columnCharts ?? []).length > 0 ? (
                                (analytics.columnCharts ?? []).map((chart, i) => (
                                    <DashSection key={i} title={chart.displayName}>
                                        <ColumnChart chart={chart} />
                                    </DashSection>
                                ))
                            ) : (
                                <>
                                    <DashSection title="Exemplo: Múltipla Escolha">
                                        <div className="h-52 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                            Sincronize respostas para visualizar.
                                        </div>
                                    </DashSection>
                                    <DashSection title="Exemplo: Sim/Não">
                                        <div className="h-52 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                            Sincronize respostas para visualizar.
                                        </div>
                                    </DashSection>
                                    <DashSection title="Exemplo: Avaliação">
                                        <div className="h-52 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                            Sincronize respostas para visualizar.
                                        </div>
                                    </DashSection>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── NUVEM DE PALAVRAS POR COLUNA ── */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">💬 Nuvem de Palavras por Coluna Aberta</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {(analytics.wordCloudColumns ?? []).length > 0 ? (
                                (analytics.wordCloudColumns ?? []).map((wcc, i) => (
                                    <DashSection key={i} title={wcc.columnName}>
                                        <WordCloud words={wcc.words} />
                                    </DashSection>
                                ))
                            ) : (
                                <>
                                    <DashSection title="Exemplo: Qual seu maior desafio?">
                                        <div className="h-48 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg mx-6 my-2">
                                            Sincronize respostas abertas para visualizar.
                                        </div>
                                    </DashSection>
                                    <DashSection title="Exemplo: Dúvidas?">
                                        <div className="h-48 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg mx-6 my-2">
                                            Sincronize respostas abertas para visualizar.
                                        </div>
                                    </DashSection>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── NUVEM GERAL ── */}
                    <DashSection title="☁️ Nuvem Geral de Palavras (Respostas Abertas)">
                        {(analytics.wordCloud ?? []).length > 0 ? (
                            <WordCloud words={analytics.wordCloud ?? []} />
                        ) : (
                            <div className="h-48 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg mx-6 my-2">
                                Nenhuma palavra encontrada.
                            </div>
                        )}
                    </DashSection>
                </>
            )}

            {/* ── TABELA DE RESPOSTAS ── */}
            {data.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">📄 Base Sincronizada de Respostas</h4>
                    <div className="rounded-xl border border-slate-700/60 overflow-hidden bg-slate-900/70">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-700/50 bg-slate-800/60">
                                    <TableHead className="text-slate-300">Nome</TableHead>
                                    <TableHead className="text-slate-300">WhatsApp</TableHead>
                                    <TableHead className="text-slate-300">Formulário</TableHead>
                                    <TableHead className="text-slate-300">Data</TableHead>
                                    <TableHead className="text-right text-slate-300">Respostas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((lead) => (
                                    <TableRow key={lead.id} className="border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                                        <TableCell className="font-medium text-slate-200">{lead.name}</TableCell>
                                        <TableCell className="text-slate-400">{lead.whatsapp || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-xs">
                                                {lead.formName}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-xs">
                                            {lead.createdAt ? format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm") : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 text-xs">
                                                        Ver Respostas
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-700">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-white">{lead.name} — Respostas</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
                                                        {lead.formData && typeof lead.formData === "object" ? (
                                                            Object.entries(lead.formData as Record<string, unknown>).map(([key, value]) => (
                                                                <div key={key} className="rounded-lg bg-slate-800/60 p-3">
                                                                    <span className="text-xs font-semibold text-indigo-400 block mb-1">{key}</span>
                                                                    <span className="text-sm text-slate-200">{String(value)}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-sm text-slate-400">Nenhuma resposta extra.</p>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {!hasData && data.length === 0 && (
                <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-700 rounded-xl text-center">
                    <Database className="w-10 h-10 text-slate-600 mb-4" />
                    <p className="text-slate-400 font-medium mb-2">Nenhum dado de lançamento encontrado.</p>
                    <p className="text-slate-500 text-sm mb-6">Configure a integração com Google Sheets no painel Admin e clique em sincronizar.</p>
                    <Button onClick={handleSync} disabled={isSyncing} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Planilha"}
                    </Button>
                </div>
            )}
        </div>
    );
}
