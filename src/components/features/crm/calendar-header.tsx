"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addMonths, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CalendarHeader({ currentDate }: { currentDate: Date }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const changeDate = (date: Date) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("date", date.toISOString());
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => changeDate(subMonths(currentDate, 1))}
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-[140px] text-center font-semibold text-sm capitalize text-slate-900 dark:text-slate-100">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => changeDate(addMonths(currentDate, 1))}
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => changeDate(new Date())}
                className="text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                Hoje
            </Button>
        </div>
    );
}
