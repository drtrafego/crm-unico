"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useUser } from "@stack-frame/stack";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = useUser();

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-6">
                    <h2 className="font-bold text-indigo-600 mr-2">Super Admin</h2>
                    <nav className="flex items-center gap-1">
                        <Link href="/adm/dashboard">
                            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 dark:text-slate-400">
                                <LayoutDashboard className="h-4 w-4" />
                                Gestão de Clientes
                            </Button>
                        </Link>
                    </nav>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={() => user.signOut()}
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </Button>
            </header>
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
