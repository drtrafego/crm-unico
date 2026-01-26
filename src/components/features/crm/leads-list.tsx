"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lead, Column as DbColumn } from "@/server/db/schema";
import { EditLeadDialog } from "@/components/features/kanban/edit-lead-dialog";
import { Search, MessageCircle, Users, Wallet, Calendar, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { getWhatsAppLink, cn } from "@/lib/utils";
import { format } from "date-fns";
import { getLeadSource } from "@/lib/leads-helper";

import { CRMActionOverrides } from "@/types/crm-actions";

interface LeadsListProps {
  leads: Lead[];
  columns: DbColumn[];
  orgId: string;
  overrides?: CRMActionOverrides;
}

export function LeadsList({ leads, columns, orgId, overrides }: LeadsListProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // ... (rest of logic)

  // NOTE: This file is truncated in view, so I must rely on finding where EditLeadDialog is utilized.
  // The view ended at line 350 which covers the end of the file.
  // I need to be careful with "rest of logic". 
  // I will target the header of the function and the usage of EditLeadDialog.

  // Wait, I can't preserve "rest of logic" easily with replace_file_content if I don't see it.
  // But I saw the whole file in step 129.
  // I will do two replacements. First the header.


  // Calculate KPIs
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, lead) => sum + parseFloat(lead.value || "0"), 0);
  const formattedTotal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue);

  const leadsWithFollowUp = leads.filter(l => l.followUpDate);
  const overdueFollowUps = leadsWithFollowUp.filter(l => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fDate = new Date(l.followUpDate!);
    fDate.setHours(0, 0, 0, 0);
    return fDate < today;
  }).length;

  const tableColumns: ColumnDef<Lead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
          Nome <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium text-slate-900 dark:text-white">{row.getValue("name")}</div>,
    },
    {
      accessorKey: "company",
      header: "Empresa",
      cell: ({ row }) => <span className="text-slate-600 dark:text-slate-400">{row.getValue("company") || "-"}</span>,
    },
    {
      id: "source", // Virtual column for normalized source
      header: "Origem",
      cell: ({ row }) => {
        const source = getLeadSource(row.original);
        return (
          <div className="flex items-center gap-1">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium border",
              source === 'Google' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                source === 'Meta' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
            )}>
              {source}
            </span>
          </div>
        );
      },
      accessorFn: (row) => getLeadSource(row) // Allow sorting by normalized source
    },
    {
      accessorKey: "columnId",
      header: "Status",
      cell: ({ row }) => {
        const colId = row.getValue("columnId") as string;
        const col = columns.find((c) => c.id === colId);
        const title = col?.title || "Unknown";
        const isWon = title.toLowerCase().includes("ganho") || title.toLowerCase().includes("won") || title.toLowerCase().includes("fechado");
        const isLost = title.toLowerCase().includes("perdido") || title.toLowerCase().includes("lost");

        return (
          <span className={cn(
            "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
            isWon ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
              isLost ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
          )}>
            {title}
          </span>
        );
      },
    },
    {
      accessorKey: "campaignSource",
      header: "Origem",
      cell: ({ row }) => {
        const source = row.getValue("campaignSource") as string | null;
        if (!source) return <span className="text-slate-300 dark:text-slate-600">-</span>;

        return (
          <span className={cn(
            "inline-block rounded-full px-2 py-0.5 text-xs font-medium border",
            source === "Google" && "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
            source === "Meta" && "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
            source === "Captação Ativa" && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
            source === "Orgânicos" && "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
            !["Google", "Meta", "Captação Ativa", "Orgânicos"].includes(source) && "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          )}>
            {source}
          </span>
        );
      },
    },
    {
      accessorKey: "followUpDate",
      header: "Retorno",
      cell: ({ row }) => {
        const date = row.getValue("followUpDate") as Date | null;
        if (!date) return <span className="text-slate-300 dark:text-slate-600">-</span>;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fDate = new Date(date);
        fDate.setHours(0, 0, 0, 0);
        const isOverdue = fDate < today;
        const isToday = fDate.getTime() === today.getTime();

        return (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isToday && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            !isOverdue && !isToday && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              isOverdue && "bg-red-500",
              isToday && "bg-amber-500",
              !isOverdue && !isToday && "bg-blue-500"
            )} />
            {format(fDate, "dd/MM")}
          </span>
        );
      },
    },
    {
      accessorKey: "whatsapp",
      header: "",
      cell: ({ row }) => {
        const whatsapp = row.getValue("whatsapp") as string;
        const whatsappLink = whatsapp ? getWhatsAppLink(whatsapp) : "";

        return whatsapp && whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 hover:text-green-700 transition-colors"
            title="Conversar no WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : null;
      }
    },
    {
      accessorKey: "value",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4">
          Valor <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("value") || "0");
        const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
        return <div className="text-right font-medium text-slate-900 dark:text-white">{formatted}</div>;
      },
    },
  ];

  const table = useReactTable({
    data: leads,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">{formattedTotal}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Retornos Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={cn("text-2xl font-bold", overdueFollowUps > 0 ? "text-red-600" : "text-slate-900 dark:text-white")}>
              {overdueFollowUps}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg text-slate-900 dark:text-white">Lista de Leads</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar leads..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-slate-200 dark:border-slate-800">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => setEditingLead(row.original)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={tableColumns.length} className="h-24 text-center text-slate-500">
                      Nenhum lead encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="border-slate-200 dark:border-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="border-slate-200 dark:border-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingLead && (
        <EditLeadDialog
          lead={editingLead}
          open={!!editingLead}
          onOpenChange={(open) => !open && setEditingLead(null)}
          orgId={orgId}
          overrides={overrides}
        />
      )}
    </div>
  );
}
