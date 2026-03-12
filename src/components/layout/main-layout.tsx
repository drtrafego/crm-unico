"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { usePathname, useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("sidebar-collapsed");
            if (stored !== null) return stored === "true";
            return window.innerWidth < 1024;
        }
        return false;
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
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
        <div className="flex flex-col lg:flex-row h-full bg-slate-50 dark:bg-slate-950 overflow-hidden premium-gradient">
            {/* Mobile Header */}
            {showSidebar && (
                <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/40 backdrop-blur-xl z-[60] h-16 shrink-0">
                    <h1 className="font-black text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tighter uppercase">
                        CRM ÚNICO
                    </h1>
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-xl">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-72 bg-slate-950 border-white/10">
                            <Sidebar isCollapsed={false} toggle={() => setIsMobileMenuOpen(false)} />
                        </SheetContent>
                    </Sheet>
                </header>
            )}

            {/* Desktop Sidebar */}
            <div className="hidden lg:block shrink-0">
                {showSidebar && <Sidebar isCollapsed={isCollapsed} toggle={toggle} />}
            </div>

            <main
                className={cn(
                    "flex-1 min-w-0 flex flex-col transition-all duration-500 ease-in-out relative",
                    pathname?.includes('/kanban') ? "overflow-hidden" : "overflow-y-auto custom-scrollbar",
                    showSidebar ? (isCollapsed ? "lg:ml-28" : "lg:ml-72") : "ml-0",
                    "p-4 sm:p-6"
                )}
            >
                {children}
            </main>
        </div>
    );
}
