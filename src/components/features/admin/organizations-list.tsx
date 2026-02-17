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
import { Search, ExternalLink, Users, Clock, Building2, Copy, Check } from "lucide-react";
import Link from "next/link";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    totalLeads: number;
    avgResponseTime: number;
}

interface OrganizationsListProps {
    organizations: Organization[];
}

function CopyableId({ id }: { id: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2 group">
            <span className="text-xs text-slate-400 font-mono truncate max-w-[80px]" title={id}>
                {id.substring(0, 8)}...
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleCopy}
                title="Copiar ID"
            >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
            </Button>
        </div>
    );
}

export function OrganizationsList({ organizations }: OrganizationsListProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    // Calculate totals for KPI cards
    const totalOrgs = organizations.length;
    const totalLeads = organizations.reduce((sum, org) => sum + org.totalLeads, 0);
    const avgResponseGlobal = organizations.filter(o => o.avgResponseTime > 0).length > 0
        ? organizations.reduce((sum, org) => sum + org.avgResponseTime, 0) / organizations.filter(o => o.avgResponseTime > 0).length
        : 0;

    const columns: ColumnDef<Organization>[] = [
        {
            accessorKey: "name",
            header: "Organização",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="font-medium">{row.getValue("name")}</span>
                </div>
            ),
        },
        {
            accessorKey: "slug",
            header: "Slug",
            cell: ({ row }) => (
                <span className="text-slate-500 dark:text-slate-400 font-mono text-sm">
                    {row.getValue("slug")}
                </span>
            ),
        },
        {
            accessorKey: "id",
            header: "ID",
            cell: ({ row }) => <CopyableId id={row.getValue("id")} />,
        },
        {
            accessorKey: "totalLeads",
            header: "Total Leads",
            cell: ({ row }) => {
                const total = row.getValue("totalLeads") as number;
                return (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                            {total}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "avgResponseTime",
            header: "Tempo Médio",
            cell: ({ row }) => {
                const time = row.getValue("avgResponseTime") as number;
                return (
                    <span className="text-slate-600 dark:text-slate-300">
                        {time > 0
                            ? formatDistance(0, time, { includeSeconds: true, locale: ptBR })
                            : "-"}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Ações</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <Link href={`/org/${row.original.slug}/kanban`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Acessar
                        </Button>
                    </Link>
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: organizations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
    });

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Total Organizações</span>
                        <Building2 className="h-5 w-5 text-indigo-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalOrgs}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Total Leads</span>
                        <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalLeads}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Tempo Médio Global</span>
                        <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                        {avgResponseGlobal > 0
                            ? formatDistance(0, avgResponseGlobal, { includeSeconds: true, locale: ptBR })
                            : "-"}
                    </p>
                </div>
            </div>

            {/* Table Container */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Organizações
                    </h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar organização..."
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent dark:hover:bg-transparent">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="text-slate-600 dark:text-slate-300">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
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
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
                                        Nenhuma organização encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {table.getFilteredRowModel().rows.length} organização(ões)
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
