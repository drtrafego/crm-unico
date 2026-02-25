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

interface LaunchLeadsClientProps {
    data: LaunchLead[];
    organizationId: string;
}

export function LaunchLeadsClient({ data, organizationId }: LaunchLeadsClientProps) {
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
    if (data.length === 0) {
        return renderEmptyState();
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleSync} disabled={isSyncing} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Planilha"}
                </Button>
            </div>

            <div className="border rounded-md bg-white dark:bg-slate-950 shadow-sm">
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
                                                    Object.entries(lead.formData as Record<string, any>).map(([key, value]) => (
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
