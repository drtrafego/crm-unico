"use client";

import { VendaHotmart } from "@/server/db/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Filter,
    X,
    CreditCard,
    MapPin,
    DollarSign,
    ShoppingCart,
    Link2,
    Calendar,
    Search,
    TrendingUp,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend,
} from "recharts";

// ----------- Types -----------
interface MatchedSale {
    id: string;
    price: number;
    status: string;
    paymentType: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    sck: string;
    scr: string;
    state: string;
    city: string;
    purchaseDate: Date | null;
    buyerName: string | null;
    buyerEmail: string;
}

interface AnalyticsData {
    summary: {
        totalValue: number;
        salesCount: number;
        totalLeads: number;
        capturedCount: number;
        formCount: number;
        matchedCount: number;
    };
    allSales: MatchedSale[];
    recentSales: VendaHotmart[];
}

interface VendasHotmartClientProps {
    data: AnalyticsData | null;
}

const CHART_COLORS = [
    "#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
    "#3b82f6", "#14b8a6", "#ec4899", "#f97316", "#06b6d4"
];

// ----------- Utility Components -----------
function DashSection({ title, children, icon: Icon, className = "" }: { title: string; children: React.ReactNode; icon?: React.ElementType; className?: string }) {
    return (
        <div className={`rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur overflow-hidden ${className}`}>
            <div className="px-5 py-3.5 border-b border-slate-700/40 bg-slate-800/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-indigo-400" />}
                    {title}
                </h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ----------- Main Component -----------
export function VendasHotmartClient({ data }: VendasHotmartClientProps) {
    const [mounted, setMounted] = useState(false);
    const [filters, setFilters] = useState<Partial<MatchedSale>>({});

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleFilter = (key: keyof MatchedSale, value: any) => {
        setFilters(prev => {
            if (prev[key] === value) {
                const newFilters = { ...prev };
                delete newFilters[key];
                return newFilters;
            }
            return { ...prev, [key]: value };
        });
    };

    const clearFilters = () => setFilters({});

    const filteredSales = useMemo(() => {
        if (!data) return [];
        return data.allSales.filter(sale => {
            return Object.entries(filters).every(([key, value]) => {
                return (sale as any)[key] === value;
            });
        });
    }, [data, filters]);

    if (!mounted) return null;
    if (!data) return <div className="p-8 text-center text-slate-400 font-medium">Nenhum dado de vendas encontrado. Certifique-se de que o Webhook está configurado.</div>;

    const totalValue = filteredSales.reduce((acc, s) => acc + s.price, 0);
    const salesCount = filteredSales.length;
    const totalLeads = data.summary.totalLeads || 0;
    const capturedCount = data.summary.capturedCount || 0;
    const formCount = data.summary.formCount || 0;
    const conversionRate = capturedCount > 0 ? (salesCount / capturedCount) * 100 : 0;

    // Aggregations for Charts
    const getDistribution = (key: keyof MatchedSale) => {
        const counts: Record<string, { count: number; value: number }> = {};
        filteredSales.forEach(s => {
            const val = String((s as any)[key] || "Desconhecido");
            if (!counts[val]) counts[val] = { count: 0, value: 0 };
            counts[val].count++;
            counts[val].value += s.price;
        });
        return Object.entries(counts)
            .map(([name, d]) => ({ name, count: d.count, value: d.value }))
            .sort((a, b) => b.count - a.count);
    };

    const sourceDist = getDistribution("utmSource");
    const mediumDist = getDistribution("utmMedium");
    const campaignDist = getDistribution("utmCampaign");
    const contentDist = getDistribution("utmContent");
    const paymentDist = getDistribution("paymentType");
    const sckDist = getDistribution("sck");

    // P1/P2 Metrics
    const p1Sales = filteredSales.filter(s => s.utmSource.includes("P1"));
    const p2Sales = filteredSales.filter(s => s.utmSource.includes("P2"));
    const p1Count = p1Sales.length;
    const p2Count = p2Sales.length;
    const p1Percent = salesCount > 0 ? (p1Count / salesCount) * 100 : 0;
    const p2Percent = salesCount > 0 ? (p2Count / salesCount) * 100 : 0;

    return (
        <div className="space-y-8 pb-20">
            {/* ── Active Filters Bar ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {Object.keys(filters).length > 0 ? (
                        <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-indigo-400">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filtros Ativos ({Object.keys(filters).length})</span>
                            <button onClick={clearFilters} className="ml-2 hover:bg-indigo-500/20 p-0.5 rounded transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-500 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/50">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm">Nenhum filtro aplicado</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECTION 1: PRIMARY KPIs ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {[
                    { label: "Leads CRM", value: capturedCount.toLocaleString('pt-BR'), sub: "Total captado ( rastreamento )", icon: Filter, color: "text-blue-400", bg: "bg-blue-400/10" },
                    { label: "Formulários", value: formCount.toLocaleString('pt-BR'), sub: "Pessoas que responderam", icon: Search, color: "text-amber-400", bg: "bg-amber-400/10" },
                    { label: "Quantidade de Vendas", value: salesCount.toLocaleString('pt-BR'), sub: "Total de transações", icon: ShoppingCart, color: "text-indigo-400", bg: "bg-indigo-400/10" },
                    { label: "Taxa de Conversão", value: `${conversionRate.toFixed(2)}%`, sub: `Baseado em ${capturedCount} leads captados`, icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-400/10" },
                ].map((kpi, i) => (
                    <div key={i} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 backdrop-blur flex items-center justify-between group hover:border-slate-500/50 transition-all duration-300">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{kpi.label}</p>
                            <p className="text-3xl font-black text-white mt-1 group-hover:scale-105 transition-transform origin-left">{kpi.value}</p>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">{kpi.sub}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${kpi.bg}`}>
                            <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── SECTION 2: GEO, PAYMENT, VALUE, SCK ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* States Heatmap Table */}
                <DashSection title="Estados" icon={MapPin} className="xl:col-span-1">
                    <div className="h-[280px] overflow-y-auto custom-scrollbar text-[11px]">
                        {(() => {
                            const stateDist = getDistribution("state");
                            const maxState = stateDist[0]?.count || 1;
                            return (
                                <Table>
                                    <TableBody>
                                        {stateDist.slice(0, 10).map((row, j) => {
                                            const intensity = Math.min(row.count / maxState, 1);
                                            return (
                                                <TableRow 
                                                    key={j} 
                                                    className={`border-slate-800 hover:opacity-80 cursor-pointer ${filters.state === row.name ? 'ring-1 ring-white/20' : ''}`} 
                                                    style={{ backgroundColor: `rgba(99, 102, 241, ${intensity * 0.4})` }}
                                                    onClick={() => toggleFilter("state", row.name)}
                                                >
                                                    <TableCell className="py-1.5 font-bold text-white">{row.name}</TableCell>
                                                    <TableCell className="text-right py-1.5 font-black">{row.count}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            );
                        })()}
                    </div>
                </DashSection>

                {/* Cities Heatmap Table */}
                <DashSection title="Cidades" icon={MapPin} className="xl:col-span-1">
                    <div className="h-[280px] overflow-y-auto custom-scrollbar text-[11px]">
                        {(() => {
                            const cityDist = getDistribution("city");
                            const maxCity = cityDist[0]?.count || 1;
                            return (
                                <Table>
                                    <TableBody>
                                        {cityDist.slice(0, 10).map((row, j) => {
                                            const intensity = Math.min(row.count / maxCity, 1);
                                            return (
                                                <TableRow 
                                                    key={j} 
                                                    className={`border-slate-800 hover:opacity-80 cursor-pointer ${filters.city === row.name ? 'ring-1 ring-white/20' : ''}`} 
                                                    style={{ backgroundColor: `rgba(16, 185, 129, ${intensity * 0.4})` }}
                                                    onClick={() => toggleFilter("city", row.name)}
                                                >
                                                    <TableCell className="py-1.5 font-bold text-white">{row.name}</TableCell>
                                                    <TableCell className="text-right py-1.5 font-black">{row.count}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            );
                        })()}
                    </div>
                </DashSection>

                {/* Payment Type Pie Chart */}
                <DashSection title="Pagamento" icon={CreditCard} className="xl:col-span-1">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentDist}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    onClick={(data) => toggleFilter("paymentType", data.name)}
                                    className="cursor-pointer"
                                >
                                    {paymentDist.map((entry, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashSection>

                {/* Value by Origin */}
                <DashSection title="Valor por Check" icon={DollarSign} className="xl:col-span-1">
                     <div className="h-[280px] overflow-y-auto custom-scrollbar">
                        <Table>
                            <TableBody>
                                {sourceDist.slice(0, 15).map((row, j) => (
                                    <TableRow key={j} className={`border-slate-800 hover:bg-slate-800/40 cursor-pointer ${filters.utmSource === row.name ? 'bg-indigo-500/10' : ''}`} onClick={() => toggleFilter("utmSource", row.name)}>
                                        <TableCell className="text-[11px] py-1.5 pr-0 font-medium text-slate-300 truncate max-w-[150px]">{row.name}</TableCell>
                                        <TableCell className="text-right text-[10px] py-1.5 font-black text-emerald-400">
                                            {row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DashSection>

                {/* SCK Pie Chart */}
                <DashSection title="SCK (Origem)" icon={Search} className="xl:col-span-1">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sckDist.slice(0, 8)}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    onClick={(data) => toggleFilter("sck", data.name)}
                                    className="cursor-pointer"
                                >
                                    {sckDist.slice(0, 8).map((entry, i) => (
                                        <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashSection>
            </div>

            {/* ── SECTION 3: ATTRIBUTION & UTM TABLES ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Main Pie Chart & P1/P2 KPI Detail */}
                <div className="space-y-6">
                    <DashSection title="Distribuição de Vendas (UTM Source)" icon={Link2}>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sourceDist}
                                        dataKey="count"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={100}
                                        outerRadius={160}
                                        paddingAngle={5}
                                        onClick={(data) => toggleFilter("utmSource", data.name)}
                                        className="cursor-pointer"
                                    >
                                        {sourceDist.map((entry, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(0,0,0,0)" />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </DashSection>

                    {/* P1 / P2 KPI Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: "Vendas P1", value: p1Count.toString(), sub: `${p1Percent.toFixed(1)}% do total` },
                            { label: "Vendas P2", value: p2Count.toString(), sub: `${p2Percent.toFixed(1)}% do total` },
                        ].map((p, i) => (
                            <div key={i} className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{p.label}</p>
                                <p className="text-2xl font-black text-white">{p.value}</p>
                                <p className="text-[10px] text-indigo-400 font-bold mt-1">{p.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detailed UTM Tables */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     {[
                        { title: "UTM Medium", data: mediumDist, key: "utmMedium" as const },
                        { title: "UTM Campaign", data: campaignDist, key: "utmCampaign" as const },
                        { title: "UTM Content", data: contentDist, key: "utmContent" as const },
                    ].map((sec, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[400px]">
                            <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{sec.title}</span>
                                {filters[sec.key] && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <Table>
                                    <TableBody>
                                        {sec.data.map((row, j) => (
                                            <TableRow 
                                                key={j} 
                                                className={`cursor-pointer transition-colors border-slate-800/50 ${filters[sec.key] === row.name ? 'bg-indigo-500/10' : 'hover:bg-slate-800/20'}`}
                                                onClick={() => toggleFilter(sec.key, row.name)}
                                            >
                                                <TableCell className="text-[11px] font-medium py-2 truncate max-w-[120px] text-slate-300">{row.name}</TableCell>
                                                <TableCell className="text-right text-[10px] font-black py-2 text-slate-500">{row.count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Transaction Feed ── */}
            <DashSection title="Vendas Recentes (Filtrado)" icon={Calendar}>
                <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-500 text-[10px] uppercase font-black">Data</TableHead>
                                <TableHead className="text-slate-500 text-[10px] uppercase font-black">Comprador</TableHead>
                                <TableHead className="text-slate-500 text-[10px] uppercase font-black text-center">Status</TableHead>
                                <TableHead className="text-right text-slate-500 text-[10px] uppercase font-black">Valor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.slice(0, 50).map((sale) => (
                                <TableRow key={sale.id} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <TableCell className="text-slate-500 text-[10px] font-medium">
                                        {sale.purchaseDate ? format(new Date(sale.purchaseDate), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-200 text-xs">{sale.buyerName}</span>
                                            <span className="text-[10px] text-slate-500 font-medium">{sale.buyerEmail}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`text-[10px] font-black uppercase ${
                                            sale.status === 'APPROVED' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-400/5' :
                                            sale.status === 'WAITING_PAYMENT' ? 'border-amber-500/20 text-amber-400 bg-amber-400/5' :
                                            'border-slate-700 text-slate-400'
                                        }`}>
                                            {sale.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-white text-xs">
                                        {sale.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DashSection>
        </div>
    );
}
