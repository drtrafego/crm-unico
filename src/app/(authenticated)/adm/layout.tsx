import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LayoutDashboard, Users } from "lucide-react";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center gap-4">
                <h2 className="font-semibold text-slate-700 dark:text-slate-200 mr-4">Super Admin</h2>
                <nav className="flex items-center gap-2">
                    <Link href="/adm/dashboard">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            Gestão de Clientes
                        </Button>
                    </Link>
                    <Link href="/adm/leads">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <Users className="h-4 w-4" />
                            Meus Leads
                        </Button>
                    </Link>
                </nav>
            </header>
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
        </div>
    );
}
