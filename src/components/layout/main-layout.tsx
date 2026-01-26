"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("sidebar-collapsed");
        if (stored === "true") {
            setIsCollapsed(true);
        } else {
            // Default to collapsed on small screens if not strictly set
            if (window.innerWidth < 1024) {
                setIsCollapsed(true);
            }
        }

        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggle = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("sidebar-collapsed", String(newState));
    };

    // Prevent hydration mismatch by using a fixed initial state until mounted, 
    // OR just accept that the first render might have margin-left-64.
    // Ideally we use a layout effect or just render. 
    // To avoid flicker we might want to default to expanded which is safer.

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar isCollapsed={isCollapsed} toggle={toggle} />
            <main
                className={cn(
                    "flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out",
                    isCollapsed ? "ml-16" : "ml-64",
                    // on mobile, the sidebar might be hidden completely or fixed overlay?
                    // The original code sidebar was fixed. 
                    // "fixed left-0 top-0 h-screen"
                    // So we just adjust the margin of the main content.
                )}
            >
                {children}
            </main>
        </div>
    );
}
