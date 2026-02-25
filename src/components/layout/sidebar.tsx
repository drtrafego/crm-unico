'use client';

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, KanbanSquare, Settings, LogOut, LineChart, CalendarDays, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stackApp } from "@/stack";
import { getOrganizationFeatures } from "@/server/actions/sidebar-features";
import { useEffect, useState } from "react";

interface SidebarProps {
  isCollapsed?: boolean;
  toggle?: () => void;
}

export function Sidebar({ isCollapsed = false, toggle }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();

  const orgSlug = params?.orgSlug as string;
  const [hasLaunchDashboard, setHasLaunchDashboard] = useState(false);

  useEffect(() => {
    if (orgSlug) {
      getOrganizationFeatures(orgSlug).then(res => {
        setHasLaunchDashboard(res.hasLaunchDashboard);
      });
    }
  }, [orgSlug]);

  // If we are not in an org context (e.g. root or admin), don't show sidebar or show different one
  if (!orgSlug) {
    if (pathname?.startsWith('/adm')) {
      return (
        <div className={cn(
          "fixed left-4 top-4 bottom-4 z-50 transition-all duration-500 ease-in-out",
          "bg-slate-950/40 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden",
          isCollapsed ? "w-20" : "w-64"
        )}>
          <div className={cn(
            "flex items-center border-b border-white/5",
            isCollapsed ? "h-20 justify-center p-0" : "h-20 p-6 justify-between"
          )}>
            {!isCollapsed && (
              <h1 className="font-black text-xl bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tighter">
                UNICO ADM
              </h1>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className={cn("text-white/70 hover:text-white hover:bg-white/10", isCollapsed ? "h-8 w-8" : "h-8 w-8")}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/adm/dashboard"
              className={cn(
                "group relative flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold transition-all duration-300",
                isCollapsed ? "justify-center" : "",
                "bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.05)] border border-white/10"
              )}
            >
              <LayoutDashboard className="!h-5 !w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!isCollapsed && "Dashboard"}
              {isCollapsed && (
                <div className="absolute left-24 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300 whitespace-nowrap shadow-2xl border border-white/10">
                  Dashboard
                </div>
              )}
            </Link>
          </nav>
          <div className="p-4 border-t border-white/5">
            <Button
              variant="ghost"
              className={cn(
                "justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-2xl transition-all duration-300",
                isCollapsed ? "justify-center px-0 w-full" : "w-full gap-3 font-bold"
              )}
              onClick={() => stackApp.signOut()}
            >
              <LogOut className="!h-5 !w-5 shrink-0" />
              {!isCollapsed && "Sair"}
            </Button>
          </div>
        </div>
      )
    }
    return null;
  }

  const items = [
    { title: "Kanban", url: `/org/${orgSlug}/kanban`, icon: KanbanSquare },
    ...(hasLaunchDashboard ? [{ title: "Lançamentos", url: `/org/${orgSlug}/launch-leads`, icon: Rocket }] : []),
    { title: "Analytics", url: `/org/${orgSlug}/analytics`, icon: LineChart },
    { title: "Calendário", url: `/org/${orgSlug}/kanban/calendar`, icon: CalendarDays },
    { title: "Configurações", url: `/org/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <div className={cn(
      "fixed left-4 top-4 bottom-4 z-50 transition-all duration-500 ease-in-out",
      "bg-white/80 dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl rounded-3xl flex flex-col overflow-hidden",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "flex items-center border-b border-white/5",
        isCollapsed ? "h-20 justify-center p-0" : "h-20 p-6 justify-between"
      )}>
        {!isCollapsed && (
          <h1 className="font-black text-xl bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tighter">
            CRM CASAL DO TRÁFEGO
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn("text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10", isCollapsed ? "h-8 w-8" : "h-8 w-8")}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {items.map((item) => {
          const isActive = pathname === item.url || pathname?.startsWith(item.url);
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold transition-all duration-300",
                isCollapsed ? "justify-center" : "",
                isActive
                  ? "bg-slate-100 dark:bg-white/15 text-slate-900 dark:text-white shadow-sm dark:shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-slate-200 dark:border-white/10"
                  : "text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
              )}
              <item.icon className={cn(
                "!h-5 !w-5 shrink-0 transition-transform duration-300",
                isActive ? "scale-110 text-indigo-400" : "group-hover:scale-110"
              )} />
              {!isCollapsed && item.title}
              {isCollapsed && (
                <div className="absolute left-24 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300 whitespace-nowrap shadow-2xl border border-white/10">
                  {item.title}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2">
        <Link href="/adm/dashboard" className="block">
          <Button
            variant="ghost"
            className={cn(
              "justify-start text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-2xl transition-all duration-300",
              isCollapsed ? "justify-center px-0 w-full" : "w-full gap-3 font-bold"
            )}
          >
            <LayoutDashboard className="!h-5 !w-5 shrink-0" />
            {!isCollapsed && "Voltar p/ Admin"}
          </Button>
        </Link>
        <Button
          variant="ghost"
          className={cn(
            "justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-2xl transition-all duration-300",
            isCollapsed ? "justify-center px-0 w-full" : "w-full gap-3 font-bold"
          )}
          onClick={() => stackApp.signOut()}
        >
          <LogOut className="!h-5 !w-5 shrink-0" />
          {!isCollapsed && "Sair"}
        </Button>
      </div>
    </div>
  );
}
