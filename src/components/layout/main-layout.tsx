"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { usePathname, useParams } from "next/navigation";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const showSidebar = !!orgSlug || pathname?.startsWith('/adm');

    useEffect(() => {
        const stored = localStorage.getItem("sidebar-collapsed");
        if (stored === "true") {
            setIsCollapsed(true);
        } else if (window.innerWidth < 1024) {
            setIsCollapsed(true);
        }

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
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {showSidebar && <Sidebar isCollapsed={isCollapsed} toggle={toggle} />}
            <main
                className={cn(
                    "flex-1 min-w-0 flex flex-col overflow-x-hidden transition-all duration-300 ease-in-out",
                    showSidebar ? (isCollapsed ? "ml-16" : "ml-64") : "ml-0"
                )}
            >
                {children}
            </main>
        </div>
    );
}
