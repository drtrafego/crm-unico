"use client";

import { useState } from "react";
import { Search, ExternalLink, Users, Clock, Building2, Copy, Check, Settings as SettingsIcon, Rocket } from "lucide-react";
import Link from "next/link";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditOrgDialog } from "./edit-org-dialog";

interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    totalLeads: number;
    avgResponseTime: number;
    features?: { hasLaunchDashboard?: boolean } | null;
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
        <button onClick={handleCopy} className="flex items-center gap-1.5 group font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <span title={id}>{id.substring(0, 8)}…</span>
            {copied
                ? <Check className="h-3 w-3 text-green-400" />
                : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            }
        </button>
    );
}

export function OrganizationsList({ organizations }: OrganizationsListProps) {
    const [filter, setFilter] = useState("");
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const totalLeads = organizations.reduce((s, o) => s + o.totalLeads, 0);
    const avgResponseGlobal = (() => {
        const valid = organizations.filter(o => o.avgResponseTime > 0);
        if (!valid.length) return 0;
        return valid.reduce((s, o) => s + o.avgResponseTime, 0) / valid.length;
    })();

    const filtered = organizations.filter(o =>
        o.name.toLowerCase().includes(filter.toLowerCase()) ||
        o.slug.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    {
                        label: "Organizações", value: organizations.length,
                        icon: <Building2 className="h-5 w-5" />, color: "text-indigo-400", bg: "bg-indigo-500/10",
                    },
                    {
                        label: "Total Leads", value: totalLeads,
                        icon: <Users className="h-5 w-5" />, color: "text-blue-400", bg: "bg-blue-500/10",
                    },
                    {
                        label: "Tempo Médio Global",
                        value: avgResponseGlobal > 0
                            ? formatDistance(0, avgResponseGlobal, { includeSeconds: true, locale: ptBR })
                            : "-",
                        icon: <Clock className="h-5 w-5" />, color: "text-amber-400", bg: "bg-amber-500/10",
                    },
                ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/8 bg-white/3 p-5 flex items-center gap-4 backdrop-blur-sm">
                        <div className={`p-2.5 rounded-xl ${card.bg}`}>
                            <span className={card.color}>{card.icon}</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                            <p className="text-2xl font-bold text-white mt-0.5">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* List Container */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 gap-3 border-b border-white/8">
                    <h2 className="text-base font-bold text-white">Organizações</h2>
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                            placeholder="Buscar..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Org Cards */}
                <div className="divide-y divide-white/5">
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-slate-500 text-sm">
                            Nenhuma organização encontrada.
                        </div>
                    )}
                    {filtered.map((org) => (
                        <div
                            key={org.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors group"
                        >
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Building2 className="h-5 w-5 text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-white truncate">{org.name}</p>
                                    <p className="text-xs text-slate-500 font-mono truncate">/org/{org.slug}</p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-5 text-sm text-slate-400 shrink-0">
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-slate-600" />
                                    <span className="text-white font-semibold">{org.totalLeads}</span>
                                    <span className="text-xs">leads</span>
                                </div>
                                {org.features?.hasLaunchDashboard && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                                        <Rocket className="h-3 w-3" />
                                        Lançamento
                                    </div>
                                )}
                                <CopyableId id={org.id} />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => { setSelectedOrg(org); setIsEditDialogOpen(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 rounded-xl transition-all"
                                >
                                    <SettingsIcon className="h-3.5 w-3.5" />
                                    Config.
                                </button>
                                <Link
                                    href={`/org/${org.slug}/kanban`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 rounded-xl transition-all"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Acessar
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/5">
                    <span className="text-xs text-slate-600">{filtered.length} de {organizations.length} organização(ões)</span>
                </div>
            </div>

            {selectedOrg && (
                <EditOrgDialog
                    key={selectedOrg.id}
                    organization={selectedOrg}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                />
            )}
        </div>
    );
}
