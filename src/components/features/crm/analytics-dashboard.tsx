"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { subDays, isWithinInterval, startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { Lead, Column } from "@/server/db/schema";
import { cn } from "@/lib/utils";
import { Users, Wallet, TrendingUp, BadgePercent } from "lucide-react";

// Cores para os gráficos
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9'];

interface AnalyticsDashboardProps {
    initialLeads: Lead[];
    columns: Column[];
}

export function AnalyticsDashboard({ initialLeads, columns }: AnalyticsDashboardProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });

    // Lógica de Processamento de Dados
    const { kpis, charts } = useMemo(() => {
        // 1. Identificar colunas de Ganho/Perda
        const wonColumnIds = columns.filter(c => c.title.toLowerCase().match(/ganho|won|fechado|vendido/)).map(c => c.id);
        // const lostColumnIds = columns.filter(c => c.title.toLowerCase().match(/perdido|lost|arquivado/)).map(c => c.id);

        // 2. Filtrar Leads por Data
        const filtered = initialLeads.filter(lead => {
            if (!dateRange?.from) return true;
            const created = lead.createdAt ? new Date(lead.createdAt) : new Date();
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            return isWithinInterval(created, { start, end });
        });

        // 3. Calcular KPIs
        const totalLeads = filtered.length;
        const wonLeads = filtered.filter(l => l.columnId && wonColumnIds.includes(l.columnId));

        // Parse de valor monetário (R$)
        const parseValue = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            const clean = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
            return parseFloat(clean) || 0;
        };

        const totalRevenue = wonLeads.reduce((sum, l) => sum + parseValue(l.value), 0);
        const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;
        const avgTicket = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;

        // 4. Dados para Gráficos

        // A) Funil de Vendas
        const funnelData = columns.map(col => ({
            name: col.title,
            value: filtered.filter(l => l.columnId === col.id).length,
            fill: COLORS[columns.indexOf(col) % COLORS.length]
        })).filter(d => d.value > 0);

        // B) Performance por Origem
        const srcMap = new Map();
        filtered.forEach(lead => {
            const src = lead.campaignSource || 'Direto';
            if (!srcMap.has(src)) srcMap.set(src, { name: src, value: 0, revenue: 0 });
            const entry = srcMap.get(src);
            entry.value++;
            if (lead.columnId && wonColumnIds.includes(lead.columnId)) entry.revenue += parseValue(lead.value);
        });
        const sourceData = Array.from(srcMap.values()).sort((a: any, b: any) => b.value - a.value);

        return {
            kpis: { totalLeads, totalRevenue, conversionRate, avgTicket },
            charts: { funnelData, sourceData }
        };
    }, [initialLeads, columns, dateRange]);

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="flex justify-end p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                <DateRangePickerWithPresets date={dateRange} setDate={setDateRange} />
            </div>

            {/* KPIs Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Total de Leads" value={kpis.totalLeads} icon={Users} color="text-blue-500" />
                <KPICard
                    title="Receita Gerada"
                    value={kpis.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    icon={Wallet}
                    color="text-emerald-500"
                />
                <KPICard title="Taxa de Conversão" value={`${kpis.conversionRate.toFixed(1)}%`} icon={BadgePercent} color="text-indigo-500" />
                <KPICard
                    title="Ticket Médio"
                    value={kpis.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    icon={TrendingUp}
                    color="text-amber-500"
                />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">Funil de Vendas</CardTitle>
                        <CardDescription>Distribuição de leads por etapa do pipeline</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.funnelData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={32}>
                                    {charts.funnelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">Origem dos Leads</CardTitle>
                        <CardDescription>Principais canais de aquisição</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={charts.sourceData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={60}
                                    paddingAngle={5}
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {charts.sourceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
    return (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate tracking-wider uppercase">{title}</p>
                    <div className={cn("p-2 rounded-lg bg-slate-50 dark:bg-slate-800", color)}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold mt-2 text-slate-900 dark:text-slate-100">{value}</h3>
            </CardContent>
        </Card>
    );
}
