"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRange } from "react-day-picker";
import { subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Column as DbColumn, Lead } from "@/server/db/schema";
import { Board } from "@/components/features/kanban/board";
import { LeadsList } from "@/components/features/crm/leads-list";
import { DateRangePickerWithPresets } from "./date-range-picker";
import { NewLeadDialog } from "@/components/features/kanban/new-lead-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp, AlertCircle, LayoutGrid, List, Wallet, Search, LucideIcon, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalyticsDashboard } from "./analytics-dashboard";

import { CompanyOnboarding } from "./company-onboarding";

import { updateViewMode } from "@/server/actions/settings";

import { CRMActionOverrides } from "@/types/crm-actions";

interface CrmViewProps {
  initialLeads: Lead[];
  columns: DbColumn[];
  companyName?: string | null;
  initialViewMode?: string | null;
  orgId: string;
  overrides?: CRMActionOverrides;
}

export function CrmView({ initialLeads, columns, companyName, initialViewMode, orgId, overrides }: CrmViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialView = (searchParams.get("view") as "board" | "list" | "analytics") || (initialViewMode as "board" | "list" | "analytics") || "board";
  const [view, setView] = useState<"board" | "list" | "analytics">(initialView);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "list" && view !== "list") setView("list");
    if (viewParam === "board" && view !== "board") setView("board");
    if (viewParam === "analytics" && view !== "analytics") setView("analytics");
  }, [searchParams, view]);

  const handleViewChange = (newView: "board" | "list" | "analytics") => {
    setView(newView);
    const params = new URLSearchParams(searchParams);
    params.set("view", newView);
    router.replace(`${pathname}?${params.toString()}`);
    updateViewMode(newView, orgId);
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30), // Last 30 days default
    to: new Date(),
  });

  // Optimistic leads state to handle instant updates from drag-and-drop
  const [optimisticLeads, setOptimisticLeads] = useState(initialLeads);

  // Sync with server props if they change (revalidation)
  useEffect(() => {
    setOptimisticLeads(initialLeads);
  }, [initialLeads]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = useMemo(() => {
    let leads = optimisticLeads;

    // 1. Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      leads = leads.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.email?.toLowerCase().includes(query) ||
        l.company?.toLowerCase().includes(query) ||
        l.whatsapp?.includes(query)
      );
    }

    // 2. Filter by Date Range
    if (!dateRange?.from) return leads;

    const start = startOfDay(dateRange.from);
    const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    return leads.filter((lead) => {
      const created = new Date(lead.createdAt);
      return isWithinInterval(created, { start, end });
    });
  }, [optimisticLeads, dateRange, searchQuery]);

  const handleLeadsChange = (newFilteredLeads: Lead[]) => {
    setOptimisticLeads(prev => {
      // Create a map of the updated leads for O(1) lookup
      const updatedMap = new Map(newFilteredLeads.map(l => [l.id, l]));

      // Merge: if lead exists in updated list, use it; otherwise keep existing
      return prev.map(l => updatedMap.get(l.id) || l);
    });
  };

  // Stats Calculation
  const totalLeads = filteredLeads.length;

  const newLeadsCount = filteredLeads.filter(l => {
    const col = columns.find(c => c.id === l.columnId);
    return col?.title.toLowerCase().includes("novos") || col?.order === 0;
  }).length;

  const wonLeads = filteredLeads.filter(l => {
    const col = columns.find(c => c.id === l.columnId);
    if (!col) return false;

    const title = col.title.toLowerCase().trim();
    // Check for keywords - STRICTLY "Fechado", "Won", "Ganho", "Vendido" for Revenue
    if (title.includes("ganho") || title.includes("won") || title.includes("fechado") || title.includes("vendido")) return true;

    // Fallback: Check for "Contrato" but NOT "Enviado" (to avoid Contrato Enviado if that exists, though usually it is Proposta)
    if (title.includes("contrato") && title.includes("fechado")) return true;

    return false;
  });

  const parseValue = (val: string | null | number | undefined) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;

    // If it matches standard float format (digits, optional dot, digits) AND no comma
    // This handles "5000.00" (DB format) correctly
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      return parseFloat(val);
    }

    // Otherwise assume BR format (comma decimal)
    // Handle currency strings like "R$ 1.200,00" or "50.000,00"
    // Remove everything that is NOT a digit or comma or minus sign
    // We assume BRL format: dot = thousand, comma = decimal
    const clean = val.toString().replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const wonValue = wonLeads.reduce((sum, lead) => sum + parseValue(lead.value), 0);

  // Custom Pipeline Value: Sum of "Proposta Enviada" ONLY as requested by user
  // "somátória ainda não está na coluna Proposta Enviada" implies specific mapping.
  const potentialValue = filteredLeads
    .filter(l => {
      const col = columns.find(c => c.id === l.columnId);
      if (!col) return false;
      const title = col.title.toLowerCase().trim();
      // Match ONLY "proposta" or "enviada" for Potential Pipeline
      return title.includes("proposta") || title.includes("enviada");
    })
    .reduce((sum, lead) => sum + parseValue(lead.value), 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Advanced Stats Calculation for sub-details
  const todayLeadsCount = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredLeads.filter(l => new Date(l.createdAt) >= today).length;
  }, [filteredLeads]);

  const lastMonthTotalLeads = useMemo(() => {
    // This is a naive calculation for demonstration: compares current 30 days vs previous 30 days
    // In a real app we might fetch more data or calculate more precisely
    const thirtyDaysAgo = subDays(new Date(), 30);
    const sixtyDaysAgo = subDays(new Date(), 60);

    const currentPeriodCount = optimisticLeads.filter(l =>
      isWithinInterval(new Date(l.createdAt), {
        start: startOfDay(thirtyDaysAgo),
        end: endOfDay(new Date())
      })
    ).length;

    const previousPeriodCount = optimisticLeads.filter(l =>
      isWithinInterval(new Date(l.createdAt), {
        start: startOfDay(sixtyDaysAgo),
        end: endOfDay(thirtyDaysAgo)
      })
    ).length;

    if (previousPeriodCount === 0) return currentPeriodCount > 0 ? 100 : 0;
    return Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);
  }, [optimisticLeads]);

  const conversionRate = useMemo(() => {
    if (totalLeads === 0) return 0;
    return Math.round((wonLeads.length / totalLeads) * 100);
  }, [totalLeads, wonLeads]);

  return (
    <div className="flex flex-col gap-3 px-2 sm:px-0 h-full">
      <CompanyOnboarding hasCompanyName={!!companyName} orgId={orgId} />
      {/* Header & Controls - Compacted */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{companyName || "Dashboard"}</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Gerencie seus leads</p>
          </div>
          <div className="relative w-full sm:w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-white dark:bg-slate-950 h-8 text-xs border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewChange("board")}
              className={cn(
                "h-7 px-2 text-[10px] font-bold",
                view === "board" && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400"
              )}
            >
              <LayoutGrid className="h-3 w-3 mr-1" /> Kanban
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewChange("list")}
              className={cn(
                "h-7 px-2 text-[10px] font-bold",
                view === "list" && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400"
              )}
            >
              <List className="h-3 w-3 mr-1" /> Lista
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewChange("analytics")}
              className={cn(
                "h-7 px-2 text-[10px] font-bold",
                view === "analytics" && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400"
              )}
            >
              <BarChart3 className="h-3 w-3 mr-1" /> Analytics
            </Button>
          </div>

          {mounted && (
            <div className="flex items-center gap-2">
              <DateRangePickerWithPresets date={dateRange} setDate={setDateRange} className="h-8 text-xs" />
              <NewLeadDialog orgId={orgId} overrides={overrides} />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards - Smaller and More Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatsCard
          title="Total de Leads"
          value={totalLeads}
          icon={Users}
          description="registrados"
          badge={{ text: `${lastMonthTotalLeads > 0 ? '+' : ''}${lastMonthTotalLeads}%`, variant: 'success' }}
          iconClassName="h-4 w-4"
        />
        <StatsCard
          title="Novos Leads"
          value={newLeadsCount}
          icon={AlertCircle}
          description="aguardando"
          badge={{ text: `+${todayLeadsCount} hoje`, variant: 'success' }}
          iconClassName="h-4 w-4 text-blue-600 dark:text-blue-400"
        />
        <StatsCard
          title="Potencial (Pipeline)"
          value={formatCurrency(potentialValue)}
          icon={TrendingUp}
          description="em negociação"
          iconClassName="h-4 w-4 text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Ganhos (Receita)"
          value={formatCurrency(wonValue)}
          icon={Wallet}
          description={`${wonLeads.length} fechados`}
          badge={{ text: `${conversionRate}%`, variant: 'success' }}
          iconClassName="h-4 w-4 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Content Area */}
      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "board" ? (
          <Board initialLeads={filteredLeads} columns={columns} onLeadsChange={handleLeadsChange} orgId={orgId} overrides={overrides} />
        ) : view === "list" ? (
          <div className="p-4 h-full overflow-y-auto">
            <LeadsList leads={filteredLeads} columns={columns} orgId={orgId} overrides={overrides} />
          </div>
        ) : (
          <AnalyticsDashboard initialLeads={filteredLeads} columns={columns} />
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  iconClassName,
  badge
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  iconClassName?: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'neutral' }
}) {
  return (
    <Card className={cn("bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 p-2.5">
        <CardTitle className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
          {title}
        </CardTitle>
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <Icon className={cn("h-3.5 w-3.5 text-slate-500 dark:text-slate-400", iconClassName)} />
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <div className="text-lg font-black text-slate-900 dark:text-slate-100 truncate mb-0.5">{value}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {badge && (
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-full",
              badge.variant === 'success' && "text-emerald-500 bg-emerald-500/10",
              badge.variant === 'warning' && "text-amber-500 bg-amber-500/10",
              badge.variant === 'neutral' && "text-slate-400 bg-slate-400/10",
            )}>
              {badge.text}
            </span>
          )}
          {description && (
            <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate tracking-tight">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
