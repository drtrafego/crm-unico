"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  LayoutGrid,
  List,
  BarChart2,
  Calendar,
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { id: "home", label: "Home", icon: Home, href: "/crm", exact: true },
  { id: "grid", label: "Grid View", icon: LayoutGrid, href: "/crm?view=board" },
  { id: "list", label: "List View", icon: List, href: "/crm?view=list" },
  { id: "chart", label: "Analytics", icon: BarChart2, href: "/crm/analytics" },
  { id: "calendar", label: "Calendar", icon: Calendar, href: "/crm/calendar" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings", className: "mt-auto" },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <aside className={cn(
      "hidden sm:flex flex-col items-center",
      "w-20 py-6 gap-6 h-[calc(100vh-2rem)] fixed left-4 top-4 z-50",
      "bg-slate-950/40 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl transition-all duration-500 hover:bg-slate-950/60"
    )}>
      <div className="mb-2">
        <div className="size-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-transform hover:scale-110 active:scale-95 duration-300">
          U
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full px-3">
        {sidebarLinks.map((l) => {
          const Icon = l.icon;
          let isActive = false;

          if (l.href.includes("?")) {
            const [path, query] = l.href.split("?");
            const params = new URLSearchParams(query);
            const viewParam = params.get("view");
            isActive = pathname === path && currentView === viewParam;
          } else if (l.exact) {
            isActive = pathname === l.href && !currentView;
          } else {
            isActive = pathname === l.href;
          }

          return (
            <Link
              key={l.id}
              href={l.href}
              className={cn(
                "relative group size-12 inline-flex items-center justify-center rounded-2xl transition-all duration-300",
                l.className,
                isActive
                  ? "bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)] border border-white/10"
                  : "bg-transparent text-slate-400 hover:text-white hover:bg-white/5 active:scale-90"
              )}
              title={l.label}
            >
              {isActive && (
                <div className="absolute -left-3 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-in fade-in zoom-in duration-500" />
              )}
              <Icon className={cn(
                "size-5 transition-all duration-300",
                isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "group-hover:scale-110"
              )} />
              <span className="sr-only">{l.label}</span>

              {/* Tooltip on hover */}
              <div className="absolute left-16 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300 whitespace-nowrap shadow-2xl border border-white/10">
                {l.label}
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
