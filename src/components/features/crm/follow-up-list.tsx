"use client";

import { Lead } from "@/server/db/schema";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowUpListProps {
    leads: Lead[];
}

export function FollowUpList({ leads }: FollowUpListProps) {
    const today = startOfDay(new Date());

    const overdue = leads.filter(l => l.followUpDate && isBefore(startOfDay(new Date(l.followUpDate)), today));
    const forToday = leads.filter(l => l.followUpDate && isSameDay(new Date(l.followUpDate), today));
    const upcoming = leads.filter(l => l.followUpDate && !isBefore(startOfDay(new Date(l.followUpDate)), today) && !isSameDay(new Date(l.followUpDate), today));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <Section
                title="Atrasados"
                count={overdue.length}
                leads={overdue}
                icon={AlertCircle}
                color="text-red-600 dark:text-red-400"
                bg="bg-red-50 dark:bg-red-900/20"
                borderColor="border-red-100 dark:border-red-800"
            />
            <Section
                title="Hoje"
                count={forToday.length}
                leads={forToday}
                icon={Clock}
                color="text-amber-600 dark:text-amber-400"
                bg="bg-amber-50 dark:bg-amber-900/20"
                borderColor="border-amber-100 dark:border-amber-800"
            />
            <Section
                title="Próximos"
                count={upcoming.length}
                leads={upcoming}
                icon={Phone}
                color="text-blue-600 dark:text-blue-400"
                bg="bg-blue-50 dark:bg-blue-900/20"
                borderColor="border-blue-100 dark:border-blue-800"
            />
        </div>
    );
}

function Section({ title, count, leads, icon: Icon, color, bg, borderColor }: any) {
    return (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-2 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <CardTitle className={cn("text-xs font-bold uppercase tracking-wider flex items-center justify-between", color)}>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {title}
                    </div>
                    <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border dark:border-slate-700">{count}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                {leads.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm italic">Nenhum registro.</div>
                ) : (
                    <div className="divide-y dark:divide-slate-800">
                        {leads.map((lead: Lead) => (
                            <div key={lead.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{lead.name}</div>
                                <div className="flex items-center justify-between mt-1">
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        {lead.followUpNote || "Sem observação de retorno"}
                                    </div>
                                    <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", bg, borderColor, color)}>
                                        {format(new Date(lead.followUpDate!), "dd/MM")}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
