"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { usePathname, useParams } from "next/navigation";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        // Initialize from localStorage if on client
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("sidebar-collapsed");
            if (stored !== null) return stored === "true";
            return window.innerWidth < 1024;
        }
        return false;
    });
    const pathname = usePathname();
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const showSidebar = !!orgSlug || pathname?.startsWith('/adm');

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggle = useCallback(() => {
        setIsCollapsed(prev => {
            const newState = !prev;
            localStorage.setItem("sidebar-collapsed", String(newState));
            return newState;
        });
    }, []);

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {showSidebar && <Sidebar isCollapsed={isCollapsed} toggle={toggle} />}
            <main
                className={cn(
                    "flex-1 min-w-0 flex flex-col transition-all duration-500 ease-in-out",
                    // Se for página de Kanban cụ thể, removemos o scroll global para que o Board gerencie.
                    // Em Configurações, Analytics ou ADM, mantemos scroll nativo.
                    pathname?.includes('/kanban') ? "overflow-hidden" : "overflow-y-auto custom-scrollbar",
                    showSidebar ? (isCollapsed ? "ml-28" : "ml-72") : "ml-0",
                    "p-4 sm:p-6" // Add some padding to content
                )}
            >
                {children}
            </main>
        </div>
    );
}
