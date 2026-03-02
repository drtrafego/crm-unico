"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { exportContacts } from "@/server/actions/contacts";
import { jsonToCsv } from "@/lib/csv-utils";
import { Download, Loader2, FileDown, Table } from "lucide-react";
import * as XLSX from "xlsx";

interface ContactExportCardProps {
    orgId: string;
}

export function ContactExportCard({ orgId }: ContactExportCardProps) {
    const [exportType, setExportType] = useState<"email" | "phone" | "both">("both");
    const [exportFormat, setExportFormat] = useState<"xls" | "csv">("xls");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const result = await exportContacts(orgId, exportType, startDate, endDate);

            if (!result.success || !result.data) {
                console.error(result.error || "Erro ao exportar contatos");
                alert("Erro ao exportar contatos. Tente novamente.");
                return;
            }

            const data = result.data;
            const timestamp = new Date().toISOString().split('T')[0];
            const fileName = `contatos-${exportType}-${timestamp}.${exportFormat}`;

            if (exportFormat === "csv") {
                const csv = jsonToCsv(data);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                link.style.visibility = "hidden";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // XLS Export
                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");
                XLSX.writeFile(workbook, fileName);
            }

            alert("Exportação concluída!");
        } catch (error) {
            console.error(error);
            alert("Erro inesperado ao exportar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                    <Download className="h-5 w-5 text-indigo-500" />
                    Exportar Contatos
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                    Baixe uma planilha com os dados dos seus leads filtrados por tipo e período.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo de Exportação</Label>
                        <Select
                            value={exportType}
                            onValueChange={(v: any) => setExportType(v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="email">Apenas Email</SelectItem>
                                <SelectItem value="phone">Apenas Telefone</SelectItem>
                                <SelectItem value="both">Ambos (Email e Telefone)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Formato</Label>
                        <Select
                            value={exportFormat}
                            onValueChange={(v: any) => setExportFormat(v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Formato" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="xls">Excel (.xlsx)</SelectItem>
                                <SelectItem value="csv">Texto (.csv)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Data Fim</Label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t p-4 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Button
                    onClick={handleExport}
                    disabled={loading}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        exportFormat === "xls" ? <FileDown className="mr-2 h-4 w-4" /> : <Table className="mr-2 h-4 w-4" />
                    )}
                    Exportar para {exportFormat === "xls" ? "Excel" : "CSV"}
                </Button>
            </CardFooter>
        </Card>
    );
}
