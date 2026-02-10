"use client";

import { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lead, Column as DbColumn } from "@/server/db/schema";
import { processAnalyticsData, calculateConversionBySource } from "@/lib/analytics-helper";
import { Users, TrendingUp, Target, MousePointerClick } from "lucide-react";

interface AnalyticsDashboardProps {
    leads: Lead[];
    columns: DbColumn[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

export function AnalyticsDashboard({ leads, columns }: AnalyticsDashboardProps) {

    const metrics = useMemo(() => {
        // Helper to determine if a lead is won
        const isWon = (lead: Lead) => {
            const col = columns.find(c => c.id === lead.columnId);
            if (!col) return false;
            const title = col.title.toLowerCase().trim();
            return title.includes("ganho") || title.includes("won") || title.includes("fechado") || title.includes("vendido") || (title.includes("contrato") && title.includes("fechado"));
        };

        const data = processAnalyticsData(leads);
        const conversionData = calculateConversionBySource(leads, isWon);

        const totalLeads = leads.length;
        const wonCount = leads.filter(isWon).length;
        const overallConversion = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

        return {
            ...data,
            conversionData,
            totalLeads,
            wonCount,
            overallConversion
        };
    }, [leads, columns]);

    return (
        <div className="space-y-4 h-full overflow-y-auto p-2 pb-20">

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                        <p className="text-xs text-muted-foreground">leads registrados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.overallConversion}%</div>
                        <p className="text-xs text-muted-foreground">leads ganhos / total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Origem</CardTitle>
                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">{metrics.sourceData[0]?.name || "-"}</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.sourceData[0]?.value || 0} leads gerados
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Campanha</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">{metrics.campaignData[0]?.name || "-"}</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.campaignData[0]?.leads || 0} leads da campanha
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Charts Row 1: Source & Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Leads by Source (Pie) */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Leads por Origem</CardTitle>
                        <CardDescription>Distribuição de leads baseada na origem (UTM ou Manual)</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.sourceData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {metrics.sourceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Conversion by Source (Bar) */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Conversão por Origem</CardTitle>
                        <CardDescription>Qualidade dos leads: quem fecha mais negócios?</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={metrics.conversionData.slice(0, 8)} // Top 8 sources
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" unit="%" domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Legend />
                                <Bar dataKey="rate" name="Taxa de Conversão (%)" fill="#82ca9d" radius={[0, 4, 4, 0]}>
                                    {metrics.conversionData.map((entry, index) => (
                                        <Cell key={`cell-conv-${index}`} fill={entry.rate > 20 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

            </div>

            {/* Main Charts Row 2: Campaigns & Pages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top Campaigns (Bar) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Campanhas (UTM)</CardTitle>
                        <CardDescription>Campanhas que mais trouxeram leads (utm_campaign)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {metrics.campaignData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.campaignData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="leads" name="Leads" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Nenhuma campanha (utm_campaign) registrada.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Pages (Bar Horizontal) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Páginas Mais Visitadas</CardTitle>
                        <CardDescription>Páginas onde o lead converteu (Page Path)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {metrics.pageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={metrics.pageData}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="leads" name="Leads" fill="#0088FE" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Nenhuma página (slug) registrada.
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
