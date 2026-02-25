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
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { syncLaunchLeadsFromSheet } from "@/server/actions/launch-leads";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, Activity } from "lucide-react";
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
    Cell
} from "recharts";

interface LaunchLeadsClientProps {
    data: LaunchLead[];
    organizationId: string;
    analytics?: {
        totalLeads: number;
        totalForms: number;
        trackingRate: number;
        utmRanking: { source: string; leads: number }[];
        temperatureData: { name: string; value: number; fill: string }[];
        wordCloud: { text: string; value: number }[];
    } | null;
}

export function LaunchLeadsClient({ data, organizationId, analytics }: LaunchLeadsClientProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncLaunchLeadsFromSheet(organizationId);
            if (res.success) {
                alert(res.message);
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

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">
            <p className="text-slate-500 mb-4">Nenhum lead de lançamento encontrado.</p>
            <Button onClick={handleSync} disabled={isSyncing} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando..." : "Sincronizar Planilha"}
            </Button>
        </div>
    );

    // Custom Word Cloud Renderer via Flex mapping
    const renderWordCloud = (words: { text: string; value: number }[]) => {
        if (!words || words.length === 0) {
            return <div className="text-sm text-slate-500 flex h-[200px] items-center justify-center">Nenhuma palavra encontrada nas respostas.</div>;
        }

        const maxVal = Math.max(...words.map(w => w.value));
        const minVal = Math.min(...words.map(w => w.value));

        return (
            <div className="flex flex-wrap flex-row justify-center items-center gap-2.5 p-4 rounded-md border min-h-[250px] bg-slate-50 dark:bg-slate-900/50">
                {words.map((w, idx) => {
                    const size = minVal === maxVal ? 1.2 : 0.8 + ((w.value - minVal) / (maxVal - minVal)) * 1.8;
                    return (
                        <span
                            key={idx}
                            style={{ fontSize: `${size}rem` }}
                            className="font-medium text-indigo-600 dark:text-indigo-400 opacity-90 transition-opacity hover:opacity-100 cursor-default"
                            title={`Mencionada ${w.value} vezes`}
                        >
                            {w.text}
                        </span>
                    );
                })}
            </div>
        );
    };

    if (data.length === 0 && (!analytics || analytics.totalLeads === 0)) {
        return renderEmptyState();
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg border">
                <div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Integração Forms/Planilha</h3>
                    <p className="text-xs text-slate-500">Puxe as repostas recém preenchidas.</p>
                </div>
                <Button onClick={handleSync} disabled={isSyncing} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Planilha"}
                </Button>
            </div>

            {analytics && (
                <>
                    {/* Top KPIs */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total de Leads Captados</CardTitle>
                                <Users className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{analytics.totalLeads}</div>
                                <p className="text-xs text-slate-500">Captação global via página.</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Respostas ao Formulário</CardTitle>
                                <FileText className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-indigo-600">{analytics.totalForms}</div>
                                <p className="text-xs text-slate-500">Sincronizados da planilha.</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Taxa de Rastreio (UTM)</CardTitle>
                                <Activity className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{analytics.trackingRate}%</div>
                                <p className="text-xs text-slate-500">Leads que chegaram rastreados.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid gap-4 md:grid-cols-12">
                        {/* UTM Bar Chart */}
                        <Card className="col-span-12 md:col-span-8">
                            <CardHeader>
                                <CardTitle>Captação - UTM SOURCE</CardTitle>
                                <CardDescription>Os 10 maiores canais de origem da captação.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.utmRanking.slice(0, 10)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis
                                            dataKey="source"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={10}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Temperature Pie Chart */}
                        <Card className="col-span-12 md:col-span-4">
                            <CardHeader>
                                <CardTitle>Temperatura (P1 vs P2)</CardTitle>
                                <CardDescription>Distribuição térmica dos leads rastreados.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] flex items-center justify-center pb-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.temperatureData.filter(d => d.value > 0)}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            label={({ value }) => value}
                                        >
                                            {analytics.temperatureData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Word Cloud Row */}
                    <div className="grid gap-4 md:grid-cols-12">
                        <Card className="col-span-12">
                            <CardHeader>
                                <CardTitle>Nuvem de Palavras das Respostas</CardTitle>
                                <CardDescription>Análise descritiva dos dados coletados nos formulários detalhados (base: {analytics.totalForms} Forms).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderWordCloud(analytics.wordCloud)}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            <div className="mt-8 border rounded-md bg-white dark:bg-slate-950 shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Base Sincronizada de Respostas</h3>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead>Formulário</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Respostas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((lead) => (
                            <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.name}</TableCell>
                                <TableCell>{lead.email}</TableCell>
                                <TableCell>{lead.whatsapp || "-"}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                        {lead.formName}
                                    </span>
                                </TableCell>
                                <TableCell>{format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                                <TableCell className="text-right">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                Ver Respostas
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>Respostas do Formulário</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                                                {lead.formData && typeof lead.formData === "object" ? (
                                                    Object.entries(lead.formData as Record<string, unknown>).map(([key, value]) => (
                                                        <div key={key} className="flex flex-col border-b pb-2 last:border-0">
                                                            <span className="text-sm font-semibold text-slate-500">{key}</span>
                                                            <span className="text-sm mt-1">{String(value)}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500">Nenhuma resposta extra.</p>
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
    );
}
