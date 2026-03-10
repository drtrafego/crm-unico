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
    Activity,
    CreditCard,
    MapPin,
    DollarSign,
    ShoppingCart,
    Link2,
    Calendar,
    Search,
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
    purchaseDate: string | null;
    buyerName: string | null;
    buyerEmail: string;
}

interface AnalyticsData {
    summary: {
        totalValue: number;
        salesCount: number;
        matchedCount: number;
    };
    allSales: MatchedSale[];
    recentSales: VendaHotmart[];
}

interface VendasHotmartClientProps {
    data: AnalyticsData | null;
}

const CHART_COLORS = [
    "#0ea5e9", "#84cc16", "#a855f7", "#f59e0b", "#f87171",
    "#fb923c", "#34d399", "#2dd4bf", "#6366f1", "#ec4899"
];

const PURPLE_BG = "bg-[#7c148c]"; // Matching the user reference image

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

    const totalFilteredValue = filteredSales.reduce((acc, s) => acc + s.price, 0);
    const totalFilteredCount = filteredSales.length;

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
    const termDist = getDistribution("utmTerm");
    const contentDist = getDistribution("utmContent");
    const statusDist = getDistribution("status");
    const paymentDist = getDistribution("paymentType");
    const sckDist = getDistribution("sck");
    const scrDist = getDistribution("scr");

    // P1/P2 KPIs (based on all matched sales, but reacting to current filters if needed? 
    // The user wants absolute and percentual. Usually P1/P2 are global metrics but let's make them reactive to current sub-filters)
    const p1Sales = filteredSales.filter(s => s.utmSource.includes("P1"));
    const p2Sales = filteredSales.filter(s => s.utmSource.includes("P2"));
    const p1Count = p1Sales.length;
    const p2Count = p2Sales.length;
    const p1Percent = totalFilteredCount > 0 ? (p1Count / totalFilteredCount) * 100 : 0;
    const p2Percent = totalFilteredCount > 0 ? (p2Count / totalFilteredCount) * 100 : 0;

    return (
        <div className={`-m-8 p-8 min-h-screen ${PURPLE_BG} text-white`}>
            {/* ── Top Header / Filters ── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    {Object.keys(filters).length > 0 && (
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                            <Filter className="w-4 h-4 text-white/60" />
                            <span className="text-sm font-medium">Filtros ativos: {Object.keys(filters).length}</span>
                            <button onClick={clearFilters} className="ml-2 hover:text-white/80 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-white/60 text-xs uppercase font-bold tracking-widest">Valor Filtrado</p>
                    <p className="text-3xl font-black">{totalFilteredValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>

            {/* ── Hero Section: Pie Chart & P1/P2 KPIs ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* Pie Chart Box */}
                <div className="bg-black/10 backdrop-blur rounded-2xl p-8 border border-white/5 flex flex-col justify-center">
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sourceDist}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={140}
                                    paddingAngle={2}
                                    onClick={(data) => toggleFilter("utmSource", data.name)}
                                    className="cursor-pointer"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                >
                                    {sourceDist.map((entry, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(255,255,255,0.1)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-4 h-full">
                    {[
                        { label: "Vendas P1", value: p1Count.toString(), type: "count" },
                        { label: "Vendas P2", value: p2Count.toString(), type: "count" },
                        { label: "Vendas P1 / Vendas Totais", value: `${p1Percent.toFixed(2)}%`, type: "percent" },
                        { label: "Vendas P2 / Vendas Totais", value: `${p2Percent.toFixed(2)}%`, type: "percent" },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-black/10 backdrop-blur rounded-2xl p-8 border border-white/5 flex flex-col items-center justify-center text-center">
                            <p className="text-white/70 text-sm font-bold mb-4 uppercase tracking-tighter">{kpi.label}</p>
                            <p className={`font-black tracking-tight ${kpi.type === 'count' ? 'text-5xl' : 'text-4xl text-indigo-200'}`}>
                                {kpi.value}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Attribution Tables (Clickable / Interactive) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { title: "UTM Source", data: sourceDist, key: "utmSource" as const },
                    { title: "UTM Medium", data: mediumDist, key: "utmMedium" as const },
                    { title: "UTM Campaign", data: campaignDist, key: "utmCampaign" as const },
                    { title: "UTM Content", data: contentDist, key: "utmContent" as const },
                ].map((sec, i) => (
                    <div key={i} className="bg-black/10 backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-white/60">{sec.title}</span>
                            {filters[sec.key] && <Badge className="bg-white/20 text-white text-[10px]">Filtrado</Badge>}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            <Table>
                                <TableBody>
                                    {sec.data.map((row, j) => (
                                        <TableRow
                                            key={j}
                                            className={`cursor-pointer transition-colors border-white/5 ${filters[sec.key] === row.name ? 'bg-white/20' : 'hover:bg-white/5'}`}
                                            onClick={() => toggleFilter(sec.key, row.name)}
                                        >
                                            <TableCell className="text-xs font-medium py-2.5 truncate max-w-[120px]">{row.name}</TableCell>
                                            <TableCell className="text-right text-[10px] font-black py-2.5 text-white/50">{row.count}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Status & Geo Tables ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-black/10 backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/60">Status de Pagamento</span>
                    </div>
                    <Table>
                        <TableBody>
                            {statusDist.map((row, j) => (
                                <TableRow key={j} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => toggleFilter("status", row.name)}>
                                    <TableCell className="text-xs font-medium py-2.5">{row.name}</TableCell>
                                    <TableCell className="text-right text-xs py-2.5">{row.count}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="bg-black/10 backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/60">Checkout (SCK / SCR)</span>
                    </div>
                    <Table>
                        <TableBody>
                            {sckDist.slice(0, 5).map((row, j) => (
                                <TableRow key={j} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => toggleFilter("sck", row.name)}>
                                    <TableCell className="text-xs font-medium py-2.5">SCK: {row.name}</TableCell>
                                    <TableCell className="text-right text-xs py-2.5">{row.count}</TableCell>
                                </TableRow>
                            ))}
                            {scrDist.slice(0, 5).map((row, j) => (
                                <TableRow key={j} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => toggleFilter("scr", row.name)}>
                                    <TableCell className="text-xs font-medium py-2.5">SCR: {row.name}</TableCell>
                                    <TableCell className="text-right text-xs py-2.5">{row.count}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="bg-black/10 backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/60">Distribuição Geográfica</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        <Table>
                            <TableBody>
                                {getDistribution("state").map((row, j) => (
                                    <TableRow key={j} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => toggleFilter("state", row.name)}>
                                        <TableCell className="text-xs font-medium py-2.5">{row.name}</TableCell>
                                        <TableCell className="text-right text-xs py-2.5 font-bold">
                                            {row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* ── Recent Sales (Filtered) ── */}
            <div className="bg-black/10 backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShoppingCart className="w-5 h-5 text-indigo-300" />
                        <h4 className="text-lg font-black tracking-tight">Vendas Transacionais</h4>
                    </div>
                    <Badge className="bg-white/20 text-white border-none">{filteredSales.length} transações na visão atual</Badge>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/5 bg-white/5 hover:bg-white/5">
                            <TableHead className="text-white/50 text-[10px] uppercase font-black">Data</TableHead>
                            <TableHead className="text-white/50 text-[10px] uppercase font-black">Comprador</TableHead>
                            <TableHead className="text-white/50 text-[10px] uppercase font-black">UTM Source</TableHead>
                            <TableHead className="text-white/50 text-[10px] uppercase font-black text-center">Status</TableHead>
                            <TableHead className="text-right text-white/50 text-[10px] uppercase font-black">Investimento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSales.slice(0, 50).map((sale) => (
                            <TableRow key={sale.id} className="border-white/5 hover:bg-white/10 transition-colors group">
                                <TableCell className="text-white/40 text-[10px] font-medium">
                                    {sale.purchaseDate ? format(new Date(sale.purchaseDate), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white text-sm tracking-tight">{sale.buyerName}</span>
                                        <span className="text-[10px] text-white/30 font-medium tracking-tight">{sale.buyerEmail}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/60 bg-white/5">
                                        {sale.utmSource}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${sale.status === 'APPROVED' ? 'text-emerald-400' :
                                            sale.status === 'WAITING_PAYMENT' ? 'text-amber-400' :
                                                'text-white/40'
                                        }`}>
                                        {sale.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-black text-white">
                                    {sale.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
