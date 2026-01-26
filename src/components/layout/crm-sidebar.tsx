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
      "hidden sm:flex flex-col items-center border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-16 py-4 gap-4 h-screen fixed left-0 top-0 z-50 shadow-sm"
    )}>
      <div className="mb-4">
        {/* Logo Placeholder or Icon */}
        <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
          B
        </div>
      </div>

      {sidebarLinks.map((l) => {
        const Icon = l.icon;
        let isActive = false;

        if (l.href.includes("?")) {
            // Check for query params
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
              "size-10 inline-flex items-center justify-center rounded-lg transition-all",
              l.className,
              isActive
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
            title={l.label}
          >
            <Icon className="size-5" />
            <span className="sr-only">{l.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
