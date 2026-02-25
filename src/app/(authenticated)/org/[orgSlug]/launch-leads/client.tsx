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

interface LaunchLeadsClientProps {
    data: LaunchLead[];
}

export function LaunchLeadsClient({ data }: LaunchLeadsClientProps) {
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-500">Nenhum lead de lançamento encontrado.</p>
            </div>
        );
    }

    return (
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
    );
}
